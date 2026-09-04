-- 0032_dashboard_demo_cleanup.sql
-- 0031 로 들어간 update-hr 데모 시드를 전량 정리한다.
-- 실제 인사 수치와 데모값이 섞이면 판독이 불가능하다.
--
-- 이 세 테이블은 0031 로 방금 만들어진 것이라 시드 외의 데이터가 없다.
-- (되돌리려면 git show d543f74:supabase/migrations/0031_dashboard_metrics.sql 의
--  시드 블록을 다시 실행해야 한다 — 복구 경로는 그것뿐이다)
--
-- 작성자 이름 표시에는 스키마 변경이 필요 없다: profiles 의 "profiles self read" 정책이
-- (id = auth.uid() or public.is_hr()) 이고 is_hr() 이 인증된 전원이라, 웹에서
-- created_by 로 profiles.name 을 조회해 붙인다(이름을 복제하지 않으므로 개명도 반영된다).
-- author_email 은 계정이 지워진 뒤에도 남는 기록이라 그대로 둔다.
--
-- 재실행 안전: 멱등.

truncate table public.hr_dashboard_notes;
truncate table public.hr_recruitment_plan;
truncate table public.hr_key_metrics;
