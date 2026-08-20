-- verify.sql
-- Phase 1 마이그레이션 적용 후 Studio SQL 편집기에서 실행할 검증 쿼리 모음.
-- 각 쿼리는 독립 실행 가능. 기대 결과를 주석으로 옆에 적어둔다.

-- (a) public 스키마의 모든 일반 테이블이 RLS enable + force 상태인지 확인.
--     기대: 0 rows (하나라도 나오면 그 테이블이 구멍이다)
select n.nspname as schema, c.relname as table,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not (c.relrowsecurity and c.relforcerowsecurity);

-- (b) anon 롤에게 SELECT 가 허용된 public 테이블이 있는지 확인.
--     기대: 0 rows (anon 은 어떤 테이블도 직접 select 하면 안 된다)
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon';

-- (b-2) authenticated 롤에게 GRANT 된 테이블 단위 권한 전수 확인(과대범위 육안 점검용).
--     기대: employees/leave_records/org_settings/user_roles/profiles/team_managers/audit_log 만
--          보이고, employee_sensitive 는 절대 나오면 안 된다. employees 의 SELECT 는 0006 에서
--          컬럼단위로 좁혔기 때문에 여기(테이블 단위 뷰)에는 안 나오는 게 정상 — 아래 (b-3) 참조.
select table_name, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
order by table_name, privilege_type;

-- (b-3) employees 의 컬럼단위 SELECT 권한 확인(0006_column_grants.sql 이 실제로 적용됐는지).
--     기대: id/user_id + 엑셀 비민감 54개 컬럼만 나오고, 주민번호·계좌·주소·연락처·개인메일
--          관련 컬럼(애초에 employees 에 없음)은 당연히 없다.
select column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'employees'
  and grantee = 'authenticated'
  and privilege_type = 'SELECT'
order by column_name;

-- (c) 헬퍼 함수/RPC 존재 확인.
--     기대: 6 rows (current_role, is_admin, is_hr, get_sensitive_masked, set_sensitive, get_ssn_full)
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_role','is_admin','is_hr',
                     'get_sensitive_masked','set_sensitive','get_ssn_full','handle_new_user');

-- (d) employee_sensitive 에 authenticated/anon 대상 권한이 전혀 없는지 확인.
--     기대: 0 rows
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'employee_sensitive'
  and grantee in ('anon','authenticated','public');

-- (d-2) employee_sensitive 에 RLS 정책이 하나도 없는지 확인(의도된 설계 — RPC 로만 접근).
--     기대: 0 rows
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public' and tablename = 'employee_sensitive';

-- (e) n8n_ingest 롤이 employees/leave_records 에 insert/update 만 갖고 select·
--     employee_sensitive 권한이 전혀 없는지 확인.
--     기대: employees/leave_records 는 INSERT,UPDATE 만 나오고, employee_sensitive 는 0 rows
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where grantee = 'n8n_ingest'
order by table_name, privilege_type;

-- (f) audit_log 가 append-only 인지(update/delete 정책이 false 로 막혀있는지) 확인.
--     기대: audit no update / audit no delete 2 rows, qual = 'false'
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'audit_log' and cmd in ('UPDATE','DELETE');

-- (g) user_roles 에 self-write 를 허용하는 정책이 없는지(오직 admin all / self read 2개만) 확인.
--     기대: 정확히 2 rows: "roles admin all"(ALL), "roles self read"(SELECT)
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'user_roles';

-- (h) 실사용 전 수동 확인(SQL 로 자동화 불가): 아래는 Studio 에서 다른 계정으로 로그인해 직접 확인.
--   - 일반 계정으로 employee_sensitive select 시도 → 42501 permission denied
--   - 일반 계정으로 get_sensitive_masked(다른 emp) 호출 → 'forbidden' 예외
--   - hr 계정으로 get_sensitive_masked(emp) 호출(app.enc_key 주입 후) → 마스킹된 jsonb 반환
--   - 팀장 계정으로 타 팀 employees select → 0 rows
