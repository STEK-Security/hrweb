-- hotfix_0019_evaluations.sql
-- Studio SQL 편집기에 이 파일 전체를 그대로 복붙해 실행하면 된다. create table if not exists /
-- create or replace function 기반이라 재실행해도 안전하다. 내용은 0019_evaluations.sql 과 동일.

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('수습','역량','성과')),
  evaluator text,
  stage text,
  status text not null default '미작성' check (status in ('진행중','완료','미작성')),
  due_date date,
  self_score integer,
  manager_score integer,
  final_grade text,
  feedback text,
  submitted_date date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;
alter table public.evaluations force row level security;
revoke all on public.evaluations from anon, authenticated;
grant select, insert, update, delete on public.evaluations to authenticated;

create policy "evaluations hr all" on public.evaluations
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists evaluations_employee_id_idx on public.evaluations (employee_id);

-- log_event 화이트리스트에 평가관리 action 추가(누적 재정의, 최종본).
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
    'create_checklist','update_checklist','delete_checklist',
    'create_training_course','update_training_course','delete_training_course',
    'create_training_record','update_training_record','delete_training_record',
    'create_evaluation','update_evaluation','delete_evaluation'
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
