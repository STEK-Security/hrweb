-- 0033_recruitment_fill_rate.sql
-- 채용 대시보드에 '충원율' 컬럼 추가(최종합격 오른쪽). 수기 입력이다.
--
-- 왜 text 인가: 최종합격 ÷ 충원예정 로 자동계산이 가능한 값이지만 수기 입력으로 쓰기로 했고,
-- '80%' 같은 서식과 '진행중'·'미정' 같은 메모를 함께 적을 수 있어야 한다.
-- (핵심지표 수치를 text 로 둔 것과 같은 이유 — 서식·상태 표기를 잃지 않는다)
-- 합계 행의 충원율만 전사 최종합격 ÷ 전사 충원예정 으로 화면에서 자동 계산한다.
--
-- ★ 이 SQL 을 웹 배포보다 먼저 실행해야 한다. 컬럼이 없는 상태로 새 웹이 뜨면
--   채용 대시보드 저장 요청이 PostgREST 400 으로 떨어져 저장 자체가 실패한다.
--
-- 재실행 안전: add column if not exists.

alter table public.hr_recruitment_plan
  add column if not exists fill_rate text;
