-- 0018_training.sql
-- 교육관리(T11.9, 신규 스키마+입력): 교육 과정(training_courses)과 직원별 수료현황(training_records).

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  target_count integer,
  start_date date,
  end_date date,
  instructor text,
  status text,
  mandatory boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default '진행중' check (status in ('수료','미수료','진행중')),
  completed_date date,
  score integer,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.training_courses enable row level security;
alter table public.training_courses force row level security;
revoke all on public.training_courses from anon, authenticated;
grant select, insert, update, delete on public.training_courses to authenticated;

create policy "training_courses hr all" on public.training_courses
  for all
  using (public.is_hr())
  with check (public.is_hr());

alter table public.training_records enable row level security;
alter table public.training_records force row level security;
revoke all on public.training_records from anon, authenticated;
grant select, insert, update, delete on public.training_records to authenticated;

create policy "training_records hr all" on public.training_records
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists training_records_course_id_idx on public.training_records (course_id);
create index if not exists training_records_employee_id_idx on public.training_records (employee_id);

-- log_event 화이트리스트에 교육관리 action 추가(누적 재정의).
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
    'create_training_record','update_training_record','delete_training_record'
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
