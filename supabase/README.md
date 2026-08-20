# Phase 1 마이그레이션 적용 가이드

원격 supabase(내부망)는 여기서 직접 붙을 수 없다. **Studio SQL 편집기**에서 아래 순서대로 적용한다.

## 1. 적용 순서

방법 A(권장): `supabase/migrations/APPLY_ALL.sql` 전체를 복사해 Studio SQL 편집기에 붙여넣고 한 번에 실행.

방법 B: `0001_roles.sql` → `0002_profiles.sql` → … → `0010_n8n_role.sql` 순서대로 파일 하나씩
복붙 실행(중간에 에러가 나면 어느 파일에서 멈췄는지 바로 알 수 있어 디버깅에 유리).

두 방법 다 **번호 순서를 지켜야 한다**(0005 의 RPC 는 0009 의 `audit_log` 테이블을 참조하지만,
함수 본문은 호출 시점에만 검증되므로 생성 순서상 문제 없음 — 단, 0009 전에 RPC를 실제로
*호출*하면 audit_log 없음 에러가 난다).

## 2. 암호화 키 주입 방법

`employee_sensitive` 의 값은 pgcrypto(`pgp_sym_encrypt`/`pgp_sym_decrypt`) 로 암호화되어 있고,
키는 **DB 스키마 어디에도 저장하지 않는다**. `get_sensitive_masked` / `set_sensitive` /
`get_ssn_full` 을 호출하는 세션에서 매번 아래를 먼저 실행해야 한다.

```sql
select set_config('app.enc_key', '<실제 키값>', true);  -- true = 트랜잭션 로컬
select public.get_sensitive_masked('<employee uuid>');
```

- `true`(트랜잭션 로컬)로 주입하면 커밋/롤백과 함께 사라진다. 커넥션 풀러(PgBouncer 등)를
  쓰는 백엔드/Edge Function 에서는 **요청마다** 주입해야 세션 재사용으로 키가 새는 걸 막는다.
- 키 자체는 별도 secret store(예: Dokploy 환경변수, Vault)에 보관하고 이 레포·커밋 이력에는
  절대 남기지 않는다.
- Studio SQL 편집기에서 수동 조회할 때도 `set_config` 를 먼저 실행해야 `pgp_sym_decrypt` 가
  성공한다. 키를 안 주면 `current_setting('app.enc_key', true)` 가 NULL 이 되어 RPC 가
  `raise exception 'encryption key not set for this session'` 로 즉시 실패한다(안전한 기본값).

## 3. 최초 관리자 계정

`user_roles` 는 self-write 가 금지되어 있어(P0-2) SQL 로 직접 심어야 한다.

1. Supabase Auth 로 계정 하나를 만든다(Studio → Authentication → 초대 또는 가입 플로우).
   `handle_new_user()` 트리거가 `profiles`/`user_roles` 기본행(role='일반')을 자동 생성한다.
2. Studio SQL 편집기(관리자 세션, RLS 우회되는 postgres 롤)에서:
   ```sql
   update public.user_roles set role = '시스템관리자', updated_by = null
   where user_id = '<방금 만든 계정의 auth.users.id>';
   ```
3. 이후부터는 이 계정으로 로그인해 관리자 화면(Task 6.1, 아직 미구현)에서 다른 계정 role 을 부여한다.

## 4. 검증

적용 후 `supabase/tests/verify.sql` 의 각 쿼리를 Studio SQL 편집기에서 실행한다.
쿼리별 기대 결과는 파일 내 주석에 있다. 핵심 요약:

| 검증 | 기대 결과 |
|---|---|
| (a) 전 테이블 RLS enable+force | 0 rows |
| (b) anon 에게 SELECT 허용된 테이블 | 0 rows |
| (c) 헬퍼함수/RPC 존재 | 7 rows |
| (d) employee_sensitive 직접 권한/정책 | 둘 다 0 rows |
| (e) n8n_ingest 권한 | employees/leave_records 만 INSERT,UPDATE, employee_sensitive 0 rows |
| (f) audit_log append-only | update/delete 정책 qual = false |
| (g) user_roles 정책 | admin all + self read 2개만 |

(h) 는 SQL 로 자동화할 수 없는 항목(다른 역할 계정으로 실제 로그인해 확인)이라 수동 체크리스트로
남겨뒀다.

## 5. n8n 연동 시 주의

- `n8n_ingest` 는 **NOLOGIN** 롤이다. n8n 이 이 자격증명으로 직접 Postgres 에 접속하지 않는다.
  스펙 8절 P0-4 권장대로 별도 인제스트 Edge Function + HMAC 토큰을 쓰거나, PostgREST 의
  `authenticator` 가 요청 클레임에 따라 `set role n8n_ingest` 로 전환하는 경로를 쓴다.
  **service_role 키를 n8n 에 절대 넘기지 않는다.**
- `n8n_ingest` 는 `employees`/`leave_records` 의 INSERT/UPDATE 만 가능하고 SELECT 는 없다.
  `employee_sensitive` 는 GRANT 자체가 없어 n8n 경로로는 민감값을 절대 못 만진다.
