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
키는 **DB 스키마 어디에도 평문으로 저장하지 않는다**.

**클라이언트(브라우저)는 이 키를 절대 주입하지 않는다.** Approach A 는 브라우저가 anon/authenticated
key 로 PostgREST 에 직결하므로, 클라이언트가 호출 가능한 `set_config`/GUC 세팅 RPC 를 만드는
순간 아무 로그인 사용자나 임의 키를 넣어 복호화를 시도할 수 있다 — 그래서 그런 RPC 는 존재하지 않는다.

> **주의(겪은 실패):** 처음엔 키를 서버측 로그인 롤(`authenticator`)에
> `alter role authenticator set app.enc_key='...'` 로 세션 기본값 고정하려 했으나, 실사용
> Supabase 인스턴스에서 `42501 permission denied to set parameter` 로 실패했다. Supabase 의
> `postgres` 롤은 슈퍼유저가 아니라 커스텀 GUC 를 `ALTER ROLE`로 설정할 권한이 없다. →
> **Supabase Vault** 로 전환한다(아래).

### Vault 방식(채택)

Studio SQL 편집기에서 관리자가 **딱 한 번** 실행:

```sql
-- 암호화 키 등록. '<강한 키>' 를 실제 값으로 바꿔 실행.
select vault.create_secret('<강한 키>', 'app_enc_key');
```

키 회전이 필요하면:

```sql
select vault.update_secret((select id from vault.secrets where name='app_enc_key'), '<새 키>');
```

이후 `get_sensitive_masked` / `set_sensitive` / `get_ssn_full` / `reveal_sensitive_field` 는
그냥 호출하면 된다 — 네 함수 모두 내부에서
`(select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key')` 로 키를
읽는다. 클라이언트는 어떤 키도 넘기지 않는다.

- 키가 등록 안 됐으면 위 서브쿼리 결과가 NULL 이 되어 RPC 가
  `raise exception 'encryption key not set for this session'` 로 즉시 실패한다(fail-closed, 안전한 기본값).
- `vault.decrypted_secrets` 는 Vault 확장이 설치된 Supabase 프로젝트에서만 존재한다(이 프로젝트는
  `VAULT_ENC_KEY` 가 있어 Vault 사용 가능 확인됨).
- 키 값 자체(실제 값)는 이 레포·커밋 이력·Dokploy 로그 어디에도 남기지 않는다.

### Vault 가 없는 self-host 대비 대체안

Vault 확장이 없는 순수 self-host Postgres 라면, 비공개 스키마 + RLS 정책 0개 테이블로 대체한다:

```sql
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.app_secrets(name text primary key, value text not null);
alter table private.app_secrets enable row level security;  -- 정책 0개 = 아무도 직접 못 읽음
revoke all on private.app_secrets from anon, authenticated;
insert into private.app_secrets(name,value) values('enc_key','<강한 키>')
  on conflict(name) do update set value=excluded.value;
```

이 경우 `0005_sensitive_rpc.sql` 세 함수의 키 조회식을
`(select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key')` 에서
`(select value from private.app_secrets where name = 'enc_key')` 로 바꾼다(함수 소유자가
postgres 라 RLS 정책이 없어도 SECURITY DEFINER 로 읽을 수 있다 — 0004/0005 의 employee_sensitive
와 같은 원리).

- **전제:** Vault 방식이든 self-host 대체안이든, 이 키를 볼 수 있는 경로(Studio SQL 편집기,
  Postgres 5432 포트 직결)가 인터넷/사내망에 그대로 열려 있으면 키 유출 = 전 직원 민감정보 유출과
  같다. 스펙 8절 P0-5(Studio·5432·관리경로 외부차단)가 반드시 함께 적용되어 있어야 한다.

### 민감정보 표시정책(사용자 지시로 변경됨)

`get_sensitive_masked(emp)` 가 반환하는 8개 항목의 기본 표시 방식:

| 항목 | 기본 표시 | 원본 조회 |
|---|---|---|
| 개인메일(email) | **전체 값 그대로** (마스킹 없음) | 해당 없음(이미 원본) |
| 휴대폰(phone) | 마스킹(`***-****-`+뒤4) | hr 가 "보이기" 버튼 → `reveal_sensitive_field(emp,'phone')` |
| 급여계좌(salary_acct) | 마스킹(계좌번호만 `***`+뒤4, 은행/예금주는 평문) | `reveal_sensitive_field(emp,'salary_acct')`(jsonb 텍스트 그대로 반환, UI 가 파싱) |
| 경비계좌(expense_acct) | 마스킹(위와 동일) | `reveal_sensitive_field(emp,'expense_acct')` |
| 주민번호(ssn) | 마스킹(`900101-1******`) | `get_ssn_full(emp)`(하위호환) 또는 `reveal_sensitive_field(emp,'ssn')` — 신규 개발은 후자로 통일 권장 |
| 현주소(addr) / 등본주소(reg_addr) | 마스킹(앞2토큰+`***`) | `reveal_sensitive_field(emp,'addr')` / `reveal_sensitive_field(emp,'reg_addr')` |
| 비상연락망(emergency) | 마스킹 | `reveal_sensitive_field(emp,'emergency')` |

`reveal_sensitive_field(emp uuid, field text)` 는 hr 전용(내부에서 `is_hr()` 재확인), 필드명은
CASE 화이트리스트로만 매칭(동적 SQL 없음), 호출마다 `audit_log` 에 `action='reveal'`,
`column_name=field` 로 기록된다. 목록에 없는 `field` 값은 `invalid field` 예외로 거부된다.

## 3. 최초 관리자 계정

`user_roles` 는 self-write 가 금지되어 있어(P0-2) SQL 로 직접 심어야 한다.

1. Supabase Auth 로 계정 하나를 만든다(Studio → Authentication → 초대 또는 가입 플로우).
   `handle_new_user()` 트리거가 `profiles`/`user_roles` 기본행(role='사용자')을 자동 생성한다.
2. Studio SQL 편집기(관리자 세션, RLS 우회되는 postgres 롤)에서:
   ```sql
   update public.user_roles set role = '시스템관리자', updated_by = null
   where user_id = '<방금 만든 계정의 auth.users.id>';
   ```
3. 이후부터는 이 계정으로 로그인해 관리자 화면(Task 6.1, 아직 미구현)에서 다른 계정 role 을 부여한다.

## 3-1. 확장분 전체 적용(0011~0014) — 권장

이미 `APPLY_ALL.sql`(0001~0010)을 적용하고 `vault.create_secret` 도 실행해둔 배포 DB 라면,
Studio SQL 편집기에서 **`supabase/migrations/APPLY_EXPANSION.sql`** 하나만 그대로 복붙해
실행하면 0011~0014(민감 RPC search_path 수정, 2역할 전환, 감사이벤트 확장, soft delete)가
전부 순서대로 반영된다(재실행해도 안전). 개별 `hotfix_0011~0014_*.sql` 파일들은 파일 단위로
하나씩 적용하고 싶을 때를 위해 그대로 남겨뒀다 — 내용은 `APPLY_EXPANSION.sql` 의 해당 절과 동일.

2역할(T8.2)은 `시스템관리자/인사담당자/팀장/일반` 4개를 `사용자/관리자` 2개로 단순화한다
(사용자=인사팀, 전 기능 / 관리자=+로그·계정·설정). `handle_new_user()` 트리거도 함께
`role='사용자'` 로 고쳐야 한다 — 안 고치면 CHECK 제약이 `사용자/관리자` 만 허용하는데 트리거는
여전히 `'일반'` 을 넣으려 해서 **신규 계정 가입이 막힌다**(`APPLY_EXPANSION.sql`/
`hotfix_0012_two_roles.sql` 둘 다 이 수정을 포함한다). 신규로 처음부터 적용하는 경우엔
`0001~0010` 다음에 `0012_two_roles.sql` 을 적용하면 된다(0002 원본이 이미 `role='사용자'` 로
고쳐져 있어 별도 트리거 수정이 필요 없다).

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
