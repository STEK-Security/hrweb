-- 0007_leave.sql
-- 휴직 관리(엑셀에 없던 신규 테이블). 기존 LeaveManagement 화면 형식과 동일한 컬럼셋.

create table if not exists public.leave_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  name text not null,
  dept text,
  position text,
  reason text,
  start_date date,
  expected_return_date date,
  substitute_assigned boolean not null default false,
  substitute_name text,
  contact text,
  status text not null default '휴직중' check (status in ('휴직중','복직예정','복직완료')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leave_records enable row level security;
alter table public.leave_records force row level security;
revoke all on public.leave_records from anon, authenticated;
grant select, insert, update, delete on public.leave_records to authenticated;

-- hr 전체 CRUD
create policy "leave hr all" on public.leave_records
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- 팀장: 본인 팀 조회만
create policy "leave mgr read" on public.leave_records
  for select
  using (dept in (select team from public.team_managers where manager_id = auth.uid()));

-- 일반: 본인(employees.user_id 매칭) 조회만
create policy "leave self read" on public.leave_records
  for select
  using (
    employee_id in (select id from public.employees where user_id = auth.uid())
  );
