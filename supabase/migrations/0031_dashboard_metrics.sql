-- 0031_dashboard_metrics.sql
-- 대시보드 핵심지표 요약(KeyMetricsSummary.tsx) + 채용 현황판(RecruitmentDashboard.tsx) +
-- 두 화면이 공용으로 쓰는 이슈 목록(DashboardNotesPanel.tsx) 을 위한 신규 테이블 3개.
-- 원본(update-hr 데모)은 localStorage 저장이었으나 DB 저장으로 교체하면서 신설.
-- 0024_fullwire_tables.sql 과 동일한 4단계 RLS 패턴을 그대로 따른다:
--   enable row level security + force row level security
--   + revoke all from anon, authenticated + grant select/insert/update/delete to authenticated
--   + is_hr() FOR ALL 정책(전 인증 사용자가 인사팀 화면이라 열람/수정 가능).
-- 증감(change)/YoY증감(yoy_change) 은 저장하지 않는다 — 프론트(metricDelta.ts)에서 매번 파생 계산.

-- ============================================================
-- 1) hr_key_metrics — KeyMetricsSummary.tsx 의 수기 입력 5행(전월/당월/전년동월)
-- ============================================================
create table if not exists public.hr_key_metrics (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  metric_key text not null,
  label text not null,
  last_month text,
  this_month text,
  last_year_month text,
  sort_order int not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (period, metric_key)
);

alter table public.hr_key_metrics enable row level security;
alter table public.hr_key_metrics force row level security;
revoke all on public.hr_key_metrics from anon, authenticated;
grant select, insert, update, delete on public.hr_key_metrics to authenticated;

drop policy if exists "hr_key_metrics hr all" on public.hr_key_metrics;
create policy "hr_key_metrics hr all" on public.hr_key_metrics
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- ============================================================
-- 2) hr_recruitment_plan — RecruitmentDashboard.tsx 의 본부/팀별 채용 현황 행
-- ============================================================
create table if not exists public.hr_recruitment_plan (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  division text not null default '',
  team text not null default '',
  current_count int not null default 0,
  retire_planned_count int not null default 0,
  recruit_planned_count int not null default 0,
  document_passed_count int not null default 0,
  interview_count int not null default 0,
  final_passed_count int not null default 0,
  sort_order int not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.hr_recruitment_plan enable row level security;
alter table public.hr_recruitment_plan force row level security;
revoke all on public.hr_recruitment_plan from anon, authenticated;
grant select, insert, update, delete on public.hr_recruitment_plan to authenticated;

drop policy if exists "hr_recruitment_plan hr all" on public.hr_recruitment_plan;
create policy "hr_recruitment_plan hr all" on public.hr_recruitment_plan
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists hr_recruitment_plan_period_sort_idx on public.hr_recruitment_plan (period, sort_order);

-- ============================================================
-- 3) hr_dashboard_notes — 핵심지표/채용 두 카드가 공용으로 쓰는 이슈 목록(자유텍스트 메모 대체)
-- ============================================================
create table if not exists public.hr_dashboard_notes (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  scope text not null check (scope in ('핵심지표','채용')),
  content text not null,
  importance text not null default '보통' check (importance in ('높음','보통','낮음')),
  author_email text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_dashboard_notes enable row level security;
alter table public.hr_dashboard_notes force row level security;
revoke all on public.hr_dashboard_notes from anon, authenticated;
grant select, insert, update, delete on public.hr_dashboard_notes to authenticated;

drop policy if exists "hr_dashboard_notes hr all" on public.hr_dashboard_notes;
create policy "hr_dashboard_notes hr all" on public.hr_dashboard_notes
  for all
  using (public.is_hr())
  with check (public.is_hr());

create index if not exists hr_dashboard_notes_period_scope_idx on public.hr_dashboard_notes (period desc, scope, created_at desc);

-- 시드 데이터는 두지 않는다. 0031 최초 적용 시에는 update-hr 데모값을 넣었는데,
-- 실제 인사 수치와 섞여 판독이 안 되므로 0032 에서 전량 정리하고 여기서도 뺐다.
-- 화면은 빈 상태에서 바로 입력 가능하다(핵심지표는 5행 골격, 채용은 [행 추가]).
