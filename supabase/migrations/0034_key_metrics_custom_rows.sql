-- 0034_key_metrics_custom_rows.sql
-- 핵심지표 요약(KeyMetricsSummary.tsx)에 "직접 입력 행" 2줄을 추가하기 위한 컬럼 2개.
--
-- 기본 5행(기말재직인원·입사자·퇴사자·퇴사율·총노무비)은 지표가 고정이라 구분(label)이
-- 프론트 상수였고, 증감·YoY증감은 calcDelta 파생이라 저장하지 않았다(0031 주석 참조).
-- 직접 입력 행은 목적이 다르다 — 담당자가 그 달에 보고 싶은 임의 항목을 쓰는 칸이라
-- 6개 열(구분·전월·당월·증감·전년동월·YoY증감)이 전부 자유 입력이어야 한다.
--
--  · 구분(label) 은 이미 hr_key_metrics.label 컬럼이 있어 추가가 필요 없다.
--    프론트 labelOf() 가 METRIC_LABELS 에 없는 metric_key 는 DB label 로 대체하므로
--    custom_1/custom_2 는 저장된 label 이 그대로 표시된다.
--  · 증감·YoY증감만 담을 곳이 없어 여기서 신설한다.
--
-- 왜 text 인가: '+3' 처럼 부호를 붙이거나 '개선'·'-' 같은 메모를 그대로 쓰기 위해서다
-- (0033 fill_rate, 0031 의 수치 컬럼을 text 로 둔 것과 같은 이유 — 서식을 잃지 않는다).
--
-- 비워두면 프론트가 기존처럼 calcDelta(당월, 기준월) 자동계산값을 보여준다.
-- 즉 이 컬럼은 "자동계산을 덮어쓰고 싶을 때만" 채우는 선택 입력이다.
--
-- ★ 이 SQL 을 웹 배포보다 먼저 실행해야 한다. 컬럼이 없는 상태로 새 웹이 뜨면
--   핵심지표 저장 요청이 PostgREST 400 으로 떨어져 저장 자체가 실패한다(0033 과 같은 함정).
--
-- 재실행 안전: add column if not exists.

alter table public.hr_key_metrics
  add column if not exists change_text text,
  add column if not exists yoy_change_text text;
