-- 0027_settings_field_grades.sql
-- 현장직 직급 목록(그룹웨어 직급 개편 2026-08). 이 직급인 사람만 현장직으로 집계하고
-- 나머지는 전부 사무직으로 집계한다(소속명 기준 판정 폐기 — 기존 /생산|품질|물류/ 규칙 대체).
-- 프론트(derive.ts)는 이 값을 읽어 적용하고, 조회 실패/미설정이면 코드 기본값을 쓴다.
-- org_settings 는 authenticated 전원 select 허용(0008)이라 사용자별로 분류가 갈리지 않는다.

insert into public.org_settings (key, value) values
  ('field_grades', '["사원(기능)", "리더", "책임"]'::jsonb)
on conflict (key) do nothing;
