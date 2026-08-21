-- 0023_demo_seed_training_eval.sql
-- DEMO SEED — 검증용, 운영 반영 후 삭제 가능.
--
-- 교육관리(training_courses/training_records)·평가관리(evaluations) 화면이 DB 무시드로
-- 비어 보이는 문제를 검증하기 위한 데모 데이터. employee_id는 하드코딩하지 않고
-- 기존 public.employees 행을 select로 참조한다.
--
-- RLS: training_courses/training_records/evaluations 는 모두 FORCE ROW LEVEL SECURITY +
-- "hr all" 정책(public.is_hr())만 허용되어 있어, 일반 authenticated 세션(비-HR)으로는
-- insert가 막힌다. 이 SQL은 Supabase Studio(관리자, RLS 우회)에서 직접 실행하는 것을 전제로 한다.
--
-- 재실행 안전: 아래 delete 문으로 이전에 이 스크립트가 넣은 데모행만 먼저 제거한 뒤 다시 넣는다.
--   - training_courses: title 이 '[DEMO] ' 로 시작하는 행(→ training_records 는 on delete cascade로 함께 제거).
--   - evaluations: evaluator 에 '(DEMO)' 마커가 포함된 행.

-- ============================================================
-- 0) 이전 데모행 정리
-- ============================================================
delete from public.training_courses where title like '[DEMO] %';
delete from public.evaluations where evaluator like '%(DEMO)%';

-- ============================================================
-- 1) 교육 과정(training_courses) + 수료현황(training_records)
--    법정의무교육 2건 / 신규입사자OJT 1건 / 리더십교육 1건 / 직무전문교육 2건 = 6개 과정.
--    과정마다 재직 중인 employees 에서 무작위 8명을 select 해 연결하고, 상태를 수료 다수로 혼합한다.
-- ============================================================

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 산업안전보건교육', '법정의무교육', 45, '2026-06-01', '2026-06-30', '한국산업안전보건공단', '마감', true)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 8
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id,
  case when e.rn <= 5 then '수료' when e.rn = 6 then '진행중' else '미수료' end,
  case when e.rn <= 5 then date '2026-06-28' end,
  case when e.rn <= 5 then 78 + e.rn * 3 end
from course c, emp e;

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 성희롱예방교육', '법정의무교육', 50, '2026-07-01', '2026-07-15', '사내 HR팀', '마감', true)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 8
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id,
  case when e.rn <= 6 then '수료' when e.rn = 7 then '진행중' else '미수료' end,
  case when e.rn <= 6 then date '2026-07-14' end,
  case when e.rn <= 6 then 80 + e.rn * 2 end
from course c, emp e;

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 신규입사자 온보딩 OJT', '신규입사자OJT', 12, '2026-08-01', '2026-08-31', '현업 멘토', '진행중', true)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 6
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id,
  case when e.rn <= 3 then '수료' when e.rn <= 5 then '진행중' else '미수료' end,
  case when e.rn <= 3 then date '2026-08-15' end,
  case when e.rn <= 3 then 85 + e.rn end
from course c, emp e;

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 리더십 역량강화 워크숍', '리더십교육', 20, '2026-09-01', '2026-09-05', '외부 리더십 컨설턴트', '모집중', false)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 5
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id, '미수료', null, null
from course c, emp e;

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 데이터분석 직무역량 과정', '직무전문교육', 25, '2026-05-10', '2026-06-10', '사내 DX팀', '마감', false)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 8
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id,
  case when e.rn <= 6 then '수료' else '미수료' end,
  case when e.rn <= 6 then date '2026-06-08' end,
  case when e.rn <= 6 then 75 + e.rn * 2 end
from course c, emp e;

with course as (
  insert into public.training_courses (title, category, target_count, start_date, end_date, instructor, status, mandatory)
  values ('[DEMO] 프로젝트관리(PMP) 직무교육', '직무전문교육', 15, '2026-10-01', '2026-10-20', '외부 교육기관', '상시', false)
  returning id
),
emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 5
  ) s
)
insert into public.training_records (course_id, employee_id, status, completed_date, score)
select c.id, e.id, '진행중', null, null
from course c, emp e;

-- ============================================================
-- 2) 평가(evaluations) — 재직 employees 12명 대상, 수습평가 위주(8건) + 역량평가 2건 + 성과평가 2건.
--    evaluator 에 '(DEMO)' 마커를 붙여 재실행 시 위 delete 문으로 식별/정리할 수 있게 한다.
-- ============================================================

with emp_pool as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 12
  ) s
),
demo_rows (rn, type, evaluator, stage, status, due_date, self_score, manager_score, final_grade, feedback, submitted_date) as (
  values
    (1, '수습', '김인사(DEMO)', '1차 수습 (1개월)', '완료', date '2026-07-15', 88, 85, 'A', '적응 우수, 업무 습득 속도 빠름.', date '2026-07-14'),
    (2, '수습', '김인사(DEMO)', '1차 수습 (1개월)', '완료', date '2026-07-20', 76, 72, 'B', '기본 업무는 무난, 커뮤니케이션 개선 필요.', date '2026-07-19'),
    (3, '수습', '박팀장(DEMO)', '최종 수습 (3개월)', '완료', date '2026-08-10', 91, 90, 'S', '핵심 성과 창출, 정규 전환 강력 추천.', date '2026-08-09'),
    (4, '수습', '박팀장(DEMO)', '최종 수습 (3개월)', '진행중', date '2026-08-25', 80, null, null, null, null),
    (5, '수습', '이과장(DEMO)', '1차 수습 (1개월)', '진행중', date '2026-08-30', null, null, null, null, null),
    (6, '수습', '이과장(DEMO)', '1차 수습 (1개월)', '미작성', date '2026-09-05', null, null, null, null, null),
    (7, '수습', '최본부장(DEMO)', '최종 수습 (3개월)', '완료', date '2026-06-30', 70, 68, 'C', '기본 역량 충족, 추가 OJT 권고.', date '2026-06-29'),
    (8, '수습', '최본부장(DEMO)', '1차 수습 (1개월)', '완료', date '2026-07-05', 84, 82, 'B', '무난한 적응, 팀 협업 양호.', date '2026-07-04'),
    (9, '역량', '박팀장(DEMO)', '상반기 역량', '완료', date '2026-06-30', 85, 88, 'A', '상반기 목표 초과 달성.', date '2026-06-28'),
    (10, '역량', '최본부장(DEMO)', '하반기 역량', '진행중', date '2026-12-15', 82, null, null, null, null),
    (11, '성과', '김인사(DEMO)', '연간 성과 MBO', '완료', date '2026-12-31', 90, 92, 'S', '연간 매출 목표 120% 달성.', date '2026-12-28'),
    (12, '성과', '이과장(DEMO)', '연간 성과 MBO', '미작성', date '2026-12-31', null, null, null, null, null)
)
insert into public.evaluations
  (employee_id, type, evaluator, stage, status, due_date, self_score, manager_score, final_grade, feedback, submitted_date)
select p.id, d.type, d.evaluator, d.stage, d.status, d.due_date, d.self_score, d.manager_score, d.final_grade, d.feedback, d.submitted_date
from demo_rows d
join emp_pool p on p.rn = d.rn;
