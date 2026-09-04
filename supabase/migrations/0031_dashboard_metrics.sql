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

-- ============================================================
-- 시드 데이터 — 원본 데모(update-hr) 의 DEFAULT_* 값을 이번 달(period) 기준으로 이식.
-- 전부 재실행 안전: hr_key_metrics 는 unique(period, metric_key) 로 on conflict do nothing,
-- 나머지 둘은 해당 period 행이 하나라도 있으면 통째로 skip.
-- ============================================================

-- 3-1) hr_key_metrics: DEFAULT_METRICS 5행. change/yoy_change 는 파생값이라 저장하지 않는다.
--      이직률(turnover_rate) 행은 this_month 를 원본 규칙대로 비활성 표시하여 빈 문자열로 둔다.
insert into public.hr_key_metrics (period, metric_key, label, last_month, this_month, last_year_month, sort_order)
values
  (to_char(current_date,'YYYY-MM'), 'closing_headcount', '기말 재직인원(명)', '638', '648', '612', 1),
  (to_char(current_date,'YYYY-MM'), 'new_hires', '입사자 수', '12', '14', '9', 2),
  (to_char(current_date,'YYYY-MM'), 'leavers', '퇴사자 수', '6', '4', '7', 3),
  (to_char(current_date,'YYYY-MM'), 'turnover_rate', '이직률', '0.94%', '', '1.14%', 4),
  (to_char(current_date,'YYYY-MM'), 'labor_cost', '총 노무비(천원)', '3,180,500', '3,245,000', '2,980,000', 5)
on conflict (period, metric_key) do nothing;

-- 3-2) hr_recruitment_plan: DEFAULT_RECRUITMENT_ROWS 5행.
insert into public.hr_recruitment_plan
  (period, division, team, current_count, retire_planned_count, recruit_planned_count, document_passed_count, interview_count, final_passed_count, sort_order)
select v.period, v.division, v.team, v.current_count, v.retire_planned_count, v.recruit_planned_count, v.document_passed_count, v.interview_count, v.final_passed_count, v.sort_order
from (
  values
    (to_char(current_date,'YYYY-MM'), '연구개발본부', 'AI솔루션팀', 24, 1, 3, 8, 4, 1, 1),
    (to_char(current_date,'YYYY-MM'), '생산본부', '생산1팀(조립)', 96, 2, 5, 14, 9, 4, 2),
    (to_char(current_date,'YYYY-MM'), '영업마케팅본부', '해외영업팀', 28, 1, 2, 6, 2, 0, 3),
    (to_char(current_date,'YYYY-MM'), '경영지원본부', '인사총무팀', 14, 0, 1, 5, 3, 1, 4),
    (to_char(current_date,'YYYY-MM'), '품질보증본부', '품질관리팀', 32, 1, 2, 7, 3, 1, 5)
) as v(period, division, team, current_count, retire_planned_count, recruit_planned_count, document_passed_count, interview_count, final_passed_count, sort_order)
where not exists (select 1 from public.hr_recruitment_plan where period = to_char(current_date,'YYYY-MM'));

-- 3-3) hr_dashboard_notes: DEFAULT_MEMO(핵심지표, 4건) + DEFAULT_RECRUITMENT_MEMO(채용, 3건).
--      대괄호 제목 줄([...])은 제외하고 번호 항목 줄만 각각 한 행으로 분리해서 넣는다.
insert into public.hr_dashboard_notes (period, scope, content, importance)
select v.period, v.scope, v.content, v.importance
from (
  values
    (to_char(current_date,'YYYY-MM'), '핵심지표', '생산1팀 신규 조립 라인 가동에 따른 현장직 8명 수시 입사 완료', '보통'),
    (to_char(current_date,'YYYY-MM'), '핵심지표', 'R&D AI솔루션팀 핵심 시니어 연구원 2명 서류 합격 및 1차 실무 면접 진행 중', '보통'),
    (to_char(current_date,'YYYY-MM'), '핵심지표', '2분기 정기 성과 상여금 지급 및 여름 휴가비 반영으로 당월 총 노무비 전월비 약 6,450만원 증가', '보통'),
    (to_char(current_date,'YYYY-MM'), '핵심지표', '육아휴직 대체인력 2명 계약 체결 및 온보딩 직무 교육 순항', '보통')
) as v(period, scope, content, importance)
where not exists (select 1 from public.hr_dashboard_notes where period = to_char(current_date,'YYYY-MM') and scope = '핵심지표');

insert into public.hr_dashboard_notes (period, scope, content, importance)
select v.period, v.scope, v.content, v.importance
from (
  values
    (to_char(current_date,'YYYY-MM'), '채용', '연구개발본부 AI솔루션팀: 서류 전형 8명 통과자 중 기술 코딩테스트 및 1차 면접 순차 진행 중', '보통'),
    (to_char(current_date,'YYYY-MM'), '채용', '생산본부 조립 라인: 주간/교대 신규 채용 4명 최종합격 통보 및 채용 건강검진 대기', '보통'),
    (to_char(current_date,'YYYY-MM'), '채용', '하반기 신입/경력 공개채용 일정: 서류접수(9월 중순), 인적성 검사 및 1차 면접(10월 초)', '보통')
) as v(period, scope, content, importance)
where not exists (select 1 from public.hr_dashboard_notes where period = to_char(current_date,'YYYY-MM') and scope = '채용');
