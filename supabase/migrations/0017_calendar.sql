-- 0017_calendar.sql
-- HR캘린더(T11.3, DB 영속): 수동 등록 일정(hr_events)과 체크리스트(hr_checklists).
-- 입퇴사일·수습평가일(입사+30/+55)·생일 등은 employees 에서 프론트가 자동 파생해 겹쳐 표시하므로
-- 여기 테이블에는 저장하지 않는다(원본 데이터가 employees 라 이중 관리를 피한다).

create table if not exists public.hr_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  end_date date,
  category text,
  location text,
  description text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.hr_checklists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  due_date date,
  completed boolean not null default false,
  assignee text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.hr_events enable row level security;
alter table public.hr_events force row level security;
revoke all on public.hr_events from anon, authenticated;
grant select, insert, update, delete on public.hr_events to authenticated;

create policy "hr_events hr all" on public.hr_events
  for all
  using (public.is_hr())
  with check (public.is_hr());

alter table public.hr_checklists enable row level security;
alter table public.hr_checklists force row level security;
revoke all on public.hr_checklists from anon, authenticated;
grant select, insert, update, delete on public.hr_checklists to authenticated;

create policy "hr_checklists hr all" on public.hr_checklists
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- log_event 화이트리스트에 캘린더 action 추가(누적 재정의).
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
    'create_transfer','update_transfer','delete_transfer',
    'create_event','update_event','delete_event',
    'create_checklist','update_checklist','delete_checklist'
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
