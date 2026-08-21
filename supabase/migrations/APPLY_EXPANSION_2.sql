-- APPLY_EXPANSION_2.sql
-- 전제: APPLY_ALL.sql(0001~0010) + APPLY_EXPANSION.sql(0011~0014) 이 이미 적용되어 있다.
-- 이 파일은 그 이후 확장분(0015~0021, 관리자·보안 포함) 전체를 한 번에 반영한다 — Studio SQL
-- 편집기에 이 파일 전체를 그대로 복붙해 실행하면 된다.
--
-- 모든 문장이 IF EXISTS/IF NOT EXISTS/CREATE OR REPLACE 기반이라 재실행해도 안전하다.
-- 구성(순서 고정):
--   (a) 0015: log_event action 화이트리스트에 issue_certificate 추가
--   (b) 0016: 인사발령이력 employee_transfers 신규 테이블 + RLS + log_event action 추가
--   (c) 0017: HR캘린더 hr_events/hr_checklists 신규 테이블 + RLS + log_event action 추가
--   (d) 0018: 교육관리 training_courses/training_records 신규 테이블 + RLS + log_event action 추가
--   (e) 0019: 평가관리 evaluations 신규 테이블 + RLS + log_event action 추가
--   (f) 0020: 관리자 화면(계정·역할관리, 조직설정) 지원 — 컬럼 grant 확장 + log_event 화이트리스트 추가
--   (g) 0021: 보안하드닝 — 비활성계정 서버측차단(P0), enabled 자기수정방지(P0),
--             audit 직접insert 회수(P1), 마지막관리자/본인역할 서버측차단(P2)(최종본)
--
-- 개별 0015~0021/hotfix_0015~0020 파일은 그대로 남아있다(파일 단위로 하나씩 적용하고 싶을 때 사용).

-- ============================================================
-- (0015_certificate_audit)
-- ============================================================

-- 0015_certificate_audit.sql
-- 증명서 발급(재직/경력) 화면(T11.8)에서 logEvent('issue_certificate', ...) 를 호출하므로
-- log_event RPC 의 action 화이트리스트에 'issue_certificate' 를 추가한다. 그 외 로직은 0013 과 동일.

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
    'issue_certificate'
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

-- ============================================================
-- (0016_transfers)
-- ============================================================

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

-- ============================================================
-- (0017_calendar)
-- ============================================================

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

-- ============================================================
-- (0018_training)
-- ============================================================

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

-- ============================================================
-- (0019_evaluations)
-- ============================================================

-- 0019_evaluations.sql
-- 평가관리(T11.10, 신규 스키마+입력): 수습/역량/성과 평가를 직원별로 기록.

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

-- log_event 화이트리스트에 평가관리 action 추가(누적 재정의).
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

-- ============================================================
-- (0020_admin)
-- ============================================================

-- 0020_admin.sql
-- 관리자 화면(T12.1 계정·역할관리, T12.2 조직설정) 지원.
-- RLS 정책("profiles admin all"/"roles admin all"/"settings admin write")은 이미 관리자만 write 를
-- 통과시키므로, 여기서는 컬럼 grant 확장(누락돼있던 profiles.enabled/user_roles.role write 권한)과
-- log_event 화이트리스트 추가만 한다.

-- profiles.enabled 는 지금까지 grant update 대상이 아니었다(0002 는 name/dept/team 만 허용).
grant update (enabled) on public.profiles to authenticated;

-- user_roles 는 지금까지 select 만 grant 돼 있었다(0001). role 변경은 관리자만 RLS 로 통과.
grant update (role, updated_by, updated_at) on public.user_roles to authenticated;

-- log_event 화이트리스트에 계정·설정 관리 action 추가(누적 재정의).
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
    'create_evaluation','update_evaluation','delete_evaluation',
    'toggle_account','update_settings'
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

-- ============================================================
-- (0021_security_hardening)
-- ============================================================

-- 0021_security_hardening.sql : 비활성계정 서버측차단(P0), enabled 자기수정방지(P0), audit 직접insert 회수(P1), 마지막관리자/본인역할 서버측차단(P2)
create or replace function public.current_role()
returns text language sql security definer set search_path = public stable as $$
  select ur.role from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.enabled = true
$$;
alter function public.current_role() owner to postgres;

create or replace function public.guard_profile_enabled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enabled is distinct from old.enabled and not public.is_admin() then
    raise exception 'forbidden: enabled is admin-only';
  end if;
  return new;
end $$;
alter function public.guard_profile_enabled() owner to postgres;
drop trigger if exists profiles_guard_enabled on public.profiles;
create trigger profiles_guard_enabled before update on public.profiles
  for each row execute function public.guard_profile_enabled();

revoke insert on public.audit_log from authenticated;

create or replace function public.guard_admin_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = auth.uid() and new.role is distinct from old.role then
    raise exception 'cannot change own role';
  end if;
  if old.role = '관리자' and new.role <> '관리자'
     and (select count(*) from public.user_roles where role = '관리자') <= 1 then
    raise exception 'cannot demote the last admin';
  end if;
  return new;
end $$;
alter function public.guard_admin_roles() owner to postgres;
drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard before update on public.user_roles
  for each row execute function public.guard_admin_roles();

