-- 0025_demo_seed_more.sql
-- DEMO SEED — Supabase Studio(관리자, RLS 우회)에서 직접 실행 전제. 재실행 안전(관련 데모행 delete 선행).
--
-- payroll_monthly: PayrollAnalysis.tsx 의 기존 initialPayrollData 데모값을 그대로 옮긴다.
-- department_productivity: 하드코딩 부서명 대신 employees 의 "전체소속명"(본부 레벨, DashboardPage.tsx
-- buildDepartmentDistribution 의 _div 와 동일 기준)에서 파생한다. 금액/지표는 실데이터 소스가 없어
-- headcount 기반 데모 파생식(부서명 해시로 소폭 변주)을 사용한다.
-- 이 두 테이블은 전량 이 시드로만 채워지므로 재실행 시 전체 delete 후 재insert.
-- employee_transfers/hr_events: 기존 실데이터가 있을 수 있으므로 note/title 에 '(DEMO)' 마커를
-- 붙여 해당 마커 행만 선행 delete 한다. employee_id 는 하드코딩하지 않고 public.employees 를
-- select 로 참조한다(재직중 행 중 무작위).

-- ============================================================
-- 0) 이전 데모행 정리
-- ============================================================
delete from public.payroll_monthly;
delete from public.department_productivity;
delete from public.employee_transfers where note like '%(DEMO)%';
delete from public.hr_events where title like '[DEMO] %';

-- ============================================================
-- 1) payroll_monthly — 2026년 1~12월(8월 당월/9~12월 예상 포함)
-- ============================================================
insert into public.payroll_monthly
  (month, current_year_amount, prev_year_amount, base_salary, bonus_amount, allowance, insurance_social, employer_contribution, new_hire_impact, note, is_bonus_peak, sort_order)
values
  ('1월', 32.4, 29.8, 23.2, 2.1, 2.8, 2.3, 2.0, 0.6, null, false, 1),
  ('2월', 32.8, 30.1, 23.5, 2.0, 2.9, 2.4, 2.0, 0.8, null, false, 2),
  ('3월', 34.5, 31.0, 24.2, 2.5, 3.1, 2.6, 2.1, 1.4, '상반기 대규모 신규 입사자 급여 반영', false, 3),
  ('4월', 34.8, 31.4, 24.5, 2.2, 3.2, 2.7, 2.2, 1.5, null, false, 4),
  ('5월', 35.1, 31.8, 24.7, 2.3, 3.2, 2.7, 2.2, 1.6, null, false, 5),
  ('6월', 35.6, 32.2, 25.0, 2.4, 3.3, 2.7, 2.2, 1.8, null, false, 6),
  ('7월', 36.2, 32.5, 25.3, 2.5, 3.4, 2.8, 2.2, 2.0, null, false, 7),
  ('8월 (당월)', 36.8, 32.9, 25.6, 2.6, 3.5, 2.8, 2.3, 2.2, null, false, 8),
  ('9월 (예상)', 37.1, 33.2, 25.8, 2.6, 3.5, 2.9, 2.3, 2.4, null, false, 9),
  ('10월 (예상)', 46.8, 41.5, 26.2, 11.8, 3.6, 2.9, 2.3, 2.7, '추석 명절 상여금 및 하반기 경영성과급 지급 스파이크', true, 10),
  ('11월 (예상)', 37.5, 33.6, 26.3, 2.7, 3.6, 2.6, 2.3, 2.8, null, false, 11),
  ('12월 (예상)', 43.2, 38.9, 26.5, 8.2, 3.6, 2.6, 2.3, 2.9, '연말 특별 인센티브 및 결산 수당', false, 12);

-- ============================================================
-- 2) department_productivity — employees "전체소속명" 본부 레벨 파생(재직자만, 실제 조직 기준)
-- ============================================================
with dept_emp as (
  select
    case
      when trim(split_part("전체소속명", '>', 2)) ~ '총괄$' then 'TBS'
      when trim(split_part("전체소속명", '>', 2)) = '' then '미지정'
      else trim(split_part("전체소속명", '>', 2))
    end as department
  from public.employees
  where "퇴직일" is null
),
dept_agg as (
  select
    department,
    count(*) as headcount,
    round(count(*) * 0.75, 1) as annual_payroll,
    -- 부서명 해시로 4.5~7.4 사이 매출배수를 소폭 변주(재실행해도 결과 동일, 데모용)
    4.5 + (abs(hashtext(department)) % 30) / 10.0 as revenue_multiplier,
    90 + (abs(hashtext(department || '_kpi')) % 9) as kpi_score
  from dept_emp
  where department <> '미지정' and department !~* '테스트|test|gpro'
  group by department
)
insert into public.department_productivity
  (department, headcount, annual_payroll, monthly_payroll_avg, generated_revenue, kpi_score, productivity_per_person, payroll_roi, sort_order)
select
  department,
  headcount,
  annual_payroll,
  round(annual_payroll * 100 / 12) as monthly_payroll_avg,
  round(headcount * revenue_multiplier, 1) as generated_revenue,
  kpi_score,
  round(revenue_multiplier, 2) as productivity_per_person,
  round((headcount * revenue_multiplier) / annual_payroll, 2) as payroll_roi,
  row_number() over (order by headcount desc) as sort_order
from dept_agg;

-- ============================================================
-- 3) employee_transfers — 2026-08~09 발령 데모 9건(승진/전보/부서이동 혼합)
-- ============================================================
with emp as (
  select id, row_number() over () as rn
  from (
    select id from public.employees where "퇴직일" is null order by random() limit 9
  ) s
),
demo_rows (rn, transfer_date, transfer_type, prev_org, new_org, prev_position, new_position, order_title) as (
  values
    (1, date '2026-08-03', '승진', '연구개발본부', '연구개발본부', '과장', '차장', '2026년 8월 정기 승진인사'),
    (2, date '2026-08-03', '승진', '생산본부', '생산본부', '대리', '과장', '2026년 8월 정기 승진인사'),
    (3, date '2026-08-05', '전보', '영업마케팅본부', '경영지원본부', '차장', '차장', '2026년 8월 전보인사'),
    (4, date '2026-08-05', '부서이동', '물류운영팀', '생산본부', '사원', '사원', '2026년 8월 부서이동'),
    (5, date '2026-08-18', '전보', '경영지원본부', '영업마케팅본부', '과장', '과장', '2026년 8월 전보인사'),
    (6, date '2026-09-01', '승진', '품질보증팀', '품질보증팀', '사원', '대리', '2026년 9월 정기 승진인사'),
    (7, date '2026-09-01', '부서이동', '연구개발본부', '품질보증팀', '대리', '대리', '2026년 9월 부서이동'),
    (8, date '2026-09-10', '전보', '생산본부', '물류운영팀', '차장', '부장', '2026년 9월 전보인사'),
    (9, date '2026-09-15', '승진', '영업마케팅본부', '영업마케팅본부', '차장', '부장', '2026년 9월 정기 승진인사')
)
insert into public.employee_transfers
  (employee_id, transfer_date, transfer_type, prev_org, new_org, prev_position, new_position, order_title, note)
select e.id, d.transfer_date, d.transfer_type, d.prev_org, d.new_org, d.prev_position, d.new_position, d.order_title,
  '(DEMO) 시드 데이터'
from demo_rows d
join emp e on e.rn = d.rn;

-- ============================================================
-- 4) hr_events — 2026-08~09 수동 일정 데모 7건(회의/교육/평가마감 등)
-- ============================================================
insert into public.hr_events (title, event_date, end_date, category, location, description) values
  ('[DEMO] 8월 정기 인사위원회', '2026-08-04', null, '회의', '본사 대회의실', '8월 정기 승진/전보 인사안 심의'),
  ('[DEMO] 산업안전보건교육', '2026-08-10', '2026-08-10', '교육', '본사 교육장', '법정의무교육, 전 직원 대상'),
  ('[DEMO] 상반기 수습평가 마감', '2026-08-15', null, '평가마감', null, '상반기 입사자 최종 수습평가 제출 마감'),
  ('[DEMO] 하반기 경영성과급 지급', '2026-08-20', null, '급여', null, '하반기 경영성과급 및 추석 상여금 지급'),
  ('[DEMO] 신규입사자 온보딩 OJT 종료', '2026-08-31', null, '교육', '현업 부서', '8월 입사자 온보딩 OJT 종료 및 피드백'),
  ('[DEMO] 9월 정기 인사위원회', '2026-09-01', null, '회의', '본사 대회의실', '9월 정기 승진/전보 인사안 심의'),
  ('[DEMO] 리더십 역량강화 워크숍', '2026-09-01', '2026-09-05', '교육', '외부 연수원', '팀장급 리더십 역량강화 워크숍');
