-- 0024_fullwire_tables.sql
-- 전면 DB연동(fullwire) 신규 테이블: 인건비 분석(payroll_monthly/department_productivity),
-- 휴직 상담기록(leave_consult_logs), 메일 발송큐(mail_queue).
-- 기존 0007/0016/0018 과 동일한 RLS 패턴(enable+force+revoke+is_hr 정책+authenticated grant)을 따른다.

-- ============================================================
-- 1) payroll_monthly — PayrollAnalysis.tsx 의 PayrollMonthlyData 1:1 대응
-- ============================================================
create table if not exists public.payroll_monthly (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  current_year_amount numeric not null,
  prev_year_amount numeric not null,
  base_salary numeric not null,
  bonus_amount numeric not null,
  allowance numeric not null,
  insurance_social numeric not null,
  employer_contribution numeric not null,
  new_hire_impact numeric not null,
  note text,
  is_bonus_peak boolean not null default false,
  sort_order int not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.payroll_monthly enable row level security;
alter table public.payroll_monthly force row level security;
revoke all on public.payroll_monthly from anon, authenticated;
grant select, insert, update, delete on public.payroll_monthly to authenticated;

create policy "payroll_monthly hr all" on public.payroll_monthly
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- ============================================================
-- 2) department_productivity — DepartmentProductivityData 1:1 대응
-- ============================================================
create table if not exists public.department_productivity (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  headcount int not null,
  annual_payroll numeric not null,
  monthly_payroll_avg numeric not null,
  generated_revenue numeric not null,
  kpi_score numeric not null,
  productivity_per_person numeric not null,
  payroll_roi numeric not null,
  sort_order int not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.department_productivity enable row level security;
alter table public.department_productivity force row level security;
revoke all on public.department_productivity from anon, authenticated;
grant select, insert, update, delete on public.department_productivity to authenticated;

create policy "department_productivity hr all" on public.department_productivity
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- ============================================================
-- 3) leave_consult_logs — 휴직자 상담기록(leave_records 종속)
-- ============================================================
create table if not exists public.leave_consult_logs (
  id uuid primary key default gen_random_uuid(),
  leave_id uuid not null references public.leave_records(id) on delete cascade,
  note text not null,
  consulted_at date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.leave_consult_logs enable row level security;
alter table public.leave_consult_logs force row level security;
revoke all on public.leave_consult_logs from anon, authenticated;
grant select, insert, update, delete on public.leave_consult_logs to authenticated;

create policy "leave_consult_logs hr all" on public.leave_consult_logs
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists leave_consult_logs_leave_id_idx on public.leave_consult_logs (leave_id, consulted_at desc);

-- ============================================================
-- 4) mail_queue — n8n(발송 주체)이 status/sent_at 을 갱신하는 발송큐.
--    authenticated(HR)는 insert/select만 가능하고 update는 막는다(임의 status 위조 방지).
--    n8n_ingest 롤(0010_n8n_role.sql 에서 생성됨)에 status/sent_at 만 컬럼단위 update 권한을 준다.
-- ============================================================
create table if not exists public.mail_queue (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  to_name text,
  subject text not null,
  body text,
  category text,
  status text not null default '대기' check (status in ('대기','발송완료','실패')),
  related_table text,
  related_id uuid,
  sent_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.mail_queue enable row level security;
alter table public.mail_queue force row level security;
revoke all on public.mail_queue from anon, authenticated;

-- authenticated(HR): insert/select만. update/delete 는 주지 않는다(status 는 n8n 이 갱신).
grant select, insert on public.mail_queue to authenticated;

create policy "mail_queue hr select" on public.mail_queue
  for select
  using (public.is_hr());

create policy "mail_queue hr insert" on public.mail_queue
  for insert
  with check (public.is_hr());

-- n8n_ingest: status/sent_at 컬럼만 update 가능(발송 결과 반영). 0010_n8n_role.sql 에서 role 생성됨.
grant update (status, sent_at) on public.mail_queue to n8n_ingest;

create policy "mail_queue n8n update status" on public.mail_queue
  for update
  to n8n_ingest
  using (true)
  with check (true);

create index if not exists mail_queue_status_idx on public.mail_queue (status, created_at);
