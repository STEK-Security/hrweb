-- 0016_transfers.sql
-- 인사발령이력(T11.5, 신규 P0): 직원별 발령(부서이동·승진·전보 등) 이력을 append 형으로 기록한다.
-- employees 의 현재 소속/직급 값 자체는 이 테이블이 건드리지 않는다 — 발령 등록 시 employees 도
-- 함께 갱신할지는 프론트(TransfersPage) 의 옵션 체크박스로 별도 update_employee 호출을 트리거한다.
-- 컬럼명은 employees 처럼 엑셀 1:1 매핑 대상이 아니므로 leave_records 와 같은 영문 snake_case 를 쓴다.

create table if not exists public.employee_transfers (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  transfer_date date not null,
  transfer_type text not null,
  prev_org text,
  new_org text,
  prev_position text,
  new_position text,
  order_title text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.employee_transfers enable row level security;
alter table public.employee_transfers force row level security;
revoke all on public.employee_transfers from anon, authenticated;
grant select, insert, update, delete on public.employee_transfers to authenticated;

-- hr(사용자/관리자) 전체 CRUD. 발령이력은 관리자 전용 설정류가 아니라 인사 업무 데이터이므로
-- employees/leave_records 와 동일하게 is_hr() 전체 허용.
create policy "transfers hr all" on public.employee_transfers
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists employee_transfers_employee_id_idx
  on public.employee_transfers (employee_id, transfer_date desc);

-- log_event 화이트리스트에 발령이력 action 추가(누적 재정의, 0015 와 동일한 방식).
create or replace function public.log_event(
  p_action text,
  p_target_id uuid default null,
  p_target_table text default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_headers jsonb;
  v_ip inet;
  v_ua text;
  v_actor_email text;
begin
  if p_action not in (
    'login_success','login_fail','logout','view_screen','view_employee',
    'create_employee','update_employee','delete_employee',
    'create_leave','update_leave','export','reveal','read_ssn_full','role_change',
    'issue_certificate',
    'create_transfer','update_transfer','delete_transfer'
  ) then
    raise exception 'invalid action';
  end if;

  if v_actor is null and p_action not in ('login_success','login_fail') then
    raise exception 'forbidden';
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    v_ua := v_headers ->> 'user-agent';
    begin
      v_ip := split_part(v_headers ->> 'x-forwarded-for', ',', 1)::inet;
    exception when others then
      v_ip := null;
    end;
  end if;

  v_actor_email := p_meta ->> 'email';

  insert into public.audit_log
    (actor, action, target_id, target_table, meta, ip, user_agent, actor_email)
  values
    (v_actor, p_action, p_target_id, p_target_table, p_meta, v_ip, v_ua, v_actor_email);
end;
$$;

alter function public.log_event(text, uuid, text, jsonb) owner to postgres;

revoke execute on function public.log_event(text, uuid, text, jsonb) from public;
grant execute on function public.log_event(text, uuid, text, jsonb) to authenticated, anon;
