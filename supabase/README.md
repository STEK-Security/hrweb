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
키는 **DB 스키마 어디에도 저장하지 않는다**.

**클라이언트(브라우저)는 이 키를 절대 주입하지 않는다.** Approach A 는 브라우저가 anon/authenticated
key 로 PostgREST 에 직결하므로, 클라이언트가 호출 가능한 `set_config`/GUC 세팅 RPC 를 만드는
순간 아무 로그인 사용자나 임의 키를 넣어 복호화를 시도할 수 있다 — 그래서 그런 RPC 는 존재하지
않는다. 대신 키는 **서버측 로그인 롤(`authenticator`)에 세션 기본값으로 1회 고정**한다. Studio
SQL 편집기에서 관리자가 딱 한 번 실행:

```sql
alter role authenticator set app.enc_key = '<실제 키값>';
```

이후 `get_sensitive_masked` / `set_sensitive` / `get_ssn_full` 은 그냥 호출하면 된다 — PostgREST
가 `authenticator` 로 접속한 세션 안에서 `set role authenticated`(또는 `n8n_ingest` 등)로 전환해도,
세션 시작 시 적용된 `app.enc_key` GUC 값은 그대로 유지된다.

- 키가 설정 안 됐거나 틀리면 `current_setting('app.enc_key', true)` 가 NULL 이 되어 RPC 가
  `raise exception 'encryption key not set for this session'` 로 즉시 실패한다(fail-closed, 안전한 기본값).
- **더 안전한 대안(권장): Supabase Vault.** GUC 는 `authenticator` 로 접속 가능한 어떤 SQL 세션에서든
  `current_setting('app.enc_key')` 로 평문 그대로 보인다. Vault 를 쓰면 평문이 GUC/설정 테이블
  어디에도 노출되지 않는다:
  ```sql
  select vault.create_secret('<실제 키값>', 'hr_enc_key');
  ```
  적용하려면 `0005_sensitive_rpc.sql` 의 세 함수에서 `current_setting('app.enc_key', true)` 를
  `(select decrypted_secret from vault.decrypted_secrets where name = 'hr_enc_key')` 로 바꾼다.
- **전제:** `ALTER ROLE ... SET` 방식이든 Vault 든, 이 키를 볼 수 있는 경로(Studio SQL 편집기,
  Postgres 5432 포트 직결)가 인터넷/사내망에 그대로 열려 있으면 키 유출 = 전 직원 민감정보 유출과
  같다. 스펙 8절 P0-5(Studio·5432·관리경로 외부차단)가 반드시 함께 적용되어 있어야 한다.
- 키 값 자체(실제 값)는 이 레포·커밋 이력·Dokploy 로그 어디에도 남기지 않는다.

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
| (e) n8n_ingest 테이블단위 권한 | 0 rows(전부 컬럼단위라 정상) |
| (e-2) n8n_ingest 컬럼단위 권한 | employees(id/user_id 제외)·leave_records(id/employee_id 제외)만 INSERT,UPDATE, SELECT 없음 |
| (e-3) employee_sensitive × n8n_ingest | 0 rows |
| (g-2) 마스킹 RPC 3개 소유자 BYPASSRLS | 3 rows 전부 true |
| (f) audit_log append-only | update/delete 정책 qual = false |
| (g) user_roles 정책 | admin all + self read 2개만 |

(h) 는 SQL 로 자동화할 수 없는 항목(다른 역할 계정으로 실제 로그인해 확인)이라 수동 체크리스트로
남겨뒀다.

**CI/배포 게이트로 사용할 것:** (a)(전 테이블 RLS enable+force)와 (b)(anon SELECT 허용 테이블)는
결과가 0 rows 가 아니면 **배포를 실패시켜야 하는** 검사다(스펙 8절 P0-1, Task 1.9 CI RLS 가드).
`scripts/check-rls.mjs`(아직 미구현, Task 1.9)가 이 두 쿼리를 실행해 1 row 이상 나오면 `exit 1`
하도록 만들고, `deploy.sh`/CI 파이프라인의 배포 전 단계에 넣는다. `0001_roles.sql` 의
`alter default privileges ... revoke all on tables from anon, authenticated;` 는 앞으로 추가될
신규 테이블에 대한 백스톱이지, 이 CI 게이트를 대체하지 않는다(백스톱은 "기본값"만 막고, 개별
마이그레이션이 실수로 `grant ... to anon` 을 명시적으로 써버리는 것까지는 못 막는다).

## 5. n8n 연동 시 주의

- `n8n_ingest` 는 **NOLOGIN** 롤이다. n8n 이 이 자격증명으로 직접 Postgres 에 접속하지 않는다.
  스펙 8절 P0-4 권장대로 별도 인제스트 Edge Function + HMAC 토큰을 쓰거나, PostgREST 의
  `authenticator` 가 요청 클레임에 따라 `set role n8n_ingest` 로 전환하는 경로를 쓴다.
  **service_role 키를 n8n 에 절대 넘기지 않는다.**
- `n8n_ingest` 는 `employees`/`leave_records` 의 INSERT/UPDATE 만 가능하고 SELECT 는 없다.
  `employee_sensitive` 는 GRANT 자체가 없어 n8n 경로로는 민감값을 절대 못 만진다.
