-- 0005_sensitive_rpc.sql
-- employee_sensitive 접근은 이 3개 SECURITY DEFINER RPC 로만 이뤄진다.
--
-- [보안 리뷰 반영 — v2] 클라이언트가 호출 가능한 set_config/GUC 세팅 RPC 는 절대 만들지 않는다.
-- Approach A(브라우저가 anon/authenticated key 로 PostgREST 에 직결)에서는 클라이언트가
-- 임의로 키를 주입할 방법이 없어야 한다.
--
-- (v1 은 `alter role authenticator set app.enc_key=...` 로 GUC 고정을 시도했으나, 실사용
-- Supabase 인스턴스에서 `42501 permission denied to set parameter` 로 실패함 — Supabase 의
-- `postgres` 롤은 슈퍼유저가 아니라 커스텀 GUC 를 ALTER ROLE 로 설정할 권한이 없다.)
--
-- → **Supabase Vault** 로 전환한다. 아래 3개 함수는 키를
-- `(select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key')` 로 읽고,
-- 결과가 없으면(NULL) 기존과 동일하게 예외로 fail-closed 한다.
--
-- ============================================================
-- [수동 실행 필요 — 배포 시 관리자 1회, Studio SQL 편집기]
--
--   -- 암호화 키 등록. '<강한 키>' 를 실제 값으로 바꿔 실행.
--   select vault.create_secret('<강한 키>', 'app_enc_key');
--   -- 키 회전:
--   select vault.update_secret((select id from vault.secrets where name='app_enc_key'), '<새 키>');
--
-- Vault 가 없는 self-host 환경 대비 대체안(둘 중 하나만 고른다): 비공개 스키마 + RLS 정책 0개
-- 테이블에 평문을 두고 SECURITY DEFINER(postgres 소유) 함수로만 읽는다 — 자세한 DDL 은
-- supabase/README.md "2. 암호화 키 주입 방법"에 있다. 이 경우 아래 함수의 키 조회식을
-- `(select value from private.app_secrets where name = 'enc_key')` 로 바꾼다.
--
-- 주의: Vault 든 대체안이든, Studio·Postgres(5432) 외부차단(스펙 8절 P0-5)이 반드시
-- 전제되어야 한다 — 이게 깨지면 키 노출 = 전 직원 민감정보 노출이다.
-- ============================================================
--
-- [배포 후 실 진단 반영 — v3] Supabase 는 pgcrypto 를 `public` 이 아니라 `extensions` 스키마에
-- 설치한다. SECURITY DEFINER 함수는 `search_path` 를 명시적으로 고정해야 하므로(하이재킹 방지),
-- `set search_path = public` 만 있으면 `pgp_sym_encrypt`/`pgp_sym_decrypt` 를 못 찾아
-- `42883 function ... does not exist` 로 실패한다. 아래 4개 함수 전부
-- `set search_path = public, extensions` 로 통일한다 — `extensions` 는 Supabase 가 신뢰
-- 확장만 설치하는 스키마라 하이재킹 위험이 없다(pgcrypto 가 로컬처럼 `public` 에 있어도
-- `public` 이 먼저 오니 그대로 잘 동작한다).

-- 마스킹 조회: hr(인사담당자/시스템관리자)만 호출 가능. 8개 민감항목 전부 마스킹해서 반환.
create or replace function public.get_sensitive_masked(emp uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  k text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key');
  r record;
  salary jsonb;
  expense jsonb;
  addr jsonb;
  reg_addr jsonb;
begin
  if not public.is_hr() then
    raise exception 'forbidden';
  end if;
  if k is null or k = '' then
    raise exception 'encryption key not set for this session';
  end if;

  select * into r from public.employee_sensitive where employee_id = emp;
  if not found then
    return jsonb_build_object();
  end if;

  salary := case when r.salary_acct_enc is null then null
    else pgp_sym_decrypt(r.salary_acct_enc, k)::jsonb end;
  expense := case when r.expense_acct_enc is null then null
    else pgp_sym_decrypt(r.expense_acct_enc, k)::jsonb end;
  addr := case when r.addr_enc is null then null
    else pgp_sym_decrypt(r.addr_enc, k)::jsonb end;
  reg_addr := case when r.reg_addr_enc is null then null
    else pgp_sym_decrypt(r.reg_addr_enc, k)::jsonb end;

  return jsonb_build_object(
    -- [보안 리뷰 반영] 뒤7자리(고유식별 번호)가 아니라 앞8자리(생년월일6+하이픈+성별코드1,
    -- 예: "900101-1")만 남기고 나머지 6자리를 마스킹한다("900101-1******").
    -- 뒤7자리를 노출하면 생년월일 평문 컬럼과 결합해 주민번호 전체가 역산 가능했다.
    'ssn', case when r.ssn_enc is null then null
      else left(pgp_sym_decrypt(r.ssn_enc, k), 8) || '******' end,

    'salary_acct', case when salary is null then null
      else jsonb_build_object(
        'bank', salary->>'bank',
        'number', '***' || right(salary->>'number', 4),
        'owner', salary->>'owner'
      ) end,

    'expense_acct', case when expense is null then null
      else jsonb_build_object(
        'bank', expense->>'bank',
        'number', '***' || right(expense->>'number', 4),
        'owner', expense->>'owner'
      ) end,

    'addr', case when addr is null then null
      else jsonb_build_object(
        'postal', addr->>'postal',
        'address', array_to_string((string_to_array(addr->>'address', ' '))[1:2], ' ') || ' ***'
      ) end,

    'reg_addr', case when reg_addr is null then null
      else jsonb_build_object(
        'postal', reg_addr->>'postal',
        'address', array_to_string((string_to_array(reg_addr->>'address', ' '))[1:2], ' ') || ' ***'
      ) end,

    'phone', case when r.phone_enc is null then null
      else '***-****-' || right(pgp_sym_decrypt(r.phone_enc, k), 4) end,

    'emergency', case when r.emergency_enc is null then null
      else (
        case when length(pgp_sym_decrypt(r.emergency_enc, k)) > 4
          then '***-****-' || right(pgp_sym_decrypt(r.emergency_enc, k), 4)
          else repeat('*', length(pgp_sym_decrypt(r.emergency_enc, k)))
        end
      ) end,

    -- [정책 변경] 개인메일은 마스킹하지 않고 전체 값을 반환한다(사용자 지시).
    'email', case when r.email_enc is null then null
      else pgp_sym_decrypt(r.email_enc, k) end
  );
end;
$$;

revoke execute on function public.get_sensitive_masked(uuid) from public;
grant execute on function public.get_sensitive_masked(uuid) to authenticated; -- 함수 내부에서 is_hr() 재확인

-- 원본 저장/갱신: hr 만. payload 는 아래 키를 선택적으로 포함하는 jsonb.
--   { "ssn": "...", "salary_acct": {"bank":"..","number":"..","owner":".."},
--     "expense_acct": {...}, "addr": {"postal":"..","address":".."},
--     "reg_addr": {...}, "phone": "...", "emergency": "...", "email": "..." }
create or replace function public.set_sensitive(emp uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key');
begin
  if not public.is_hr() then
    raise exception 'forbidden';
  end if;
  if k is null or k = '' then
    raise exception 'encryption key not set for this session';
  end if;

  insert into public.employee_sensitive (employee_id)
    values (emp)
    on conflict (employee_id) do nothing;

  update public.employee_sensitive set
    ssn_enc = case when payload ? 'ssn'
      then pgp_sym_encrypt(payload->>'ssn', k) else ssn_enc end,
    salary_acct_enc = case when payload ? 'salary_acct'
      then pgp_sym_encrypt((payload->'salary_acct')::text, k) else salary_acct_enc end,
    expense_acct_enc = case when payload ? 'expense_acct'
      then pgp_sym_encrypt((payload->'expense_acct')::text, k) else expense_acct_enc end,
    addr_enc = case when payload ? 'addr'
      then pgp_sym_encrypt((payload->'addr')::text, k) else addr_enc end,
    reg_addr_enc = case when payload ? 'reg_addr'
      then pgp_sym_encrypt((payload->'reg_addr')::text, k) else reg_addr_enc end,
    phone_enc = case when payload ? 'phone'
      then pgp_sym_encrypt(payload->>'phone', k) else phone_enc end,
    emergency_enc = case when payload ? 'emergency'
      then pgp_sym_encrypt(payload->>'emergency', k) else emergency_enc end,
    email_enc = case when payload ? 'email'
      then pgp_sym_encrypt(payload->>'email', k) else email_enc end,
    updated_by = auth.uid(),
    updated_at = now()
  where employee_id = emp;

  -- 민감 원본은 절대 기록하지 않는다. 변경된 컬럼명만 건별로 남긴다.
  insert into public.audit_log (actor, action, target_id, target_table, column_name)
    select auth.uid(), 'set_sensitive', emp, 'employee_sensitive', key
    from jsonb_object_keys(payload) as key;
end;
$$;

revoke execute on function public.set_sensitive(uuid, jsonb) from public;
grant execute on function public.set_sensitive(uuid, jsonb) to authenticated; -- 함수 내부에서 is_hr() 재확인

-- 주민번호 원본: hr 만, 호출 자체를 감사로그에 남긴다(최소노출 원칙).
create or replace function public.get_ssn_full(emp uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key');
  v text;
begin
  if not public.is_hr() then
    raise exception 'forbidden';
  end if;
  if k is null or k = '' then
    raise exception 'encryption key not set for this session';
  end if;

  select pgp_sym_decrypt(ssn_enc, k) into v
    from public.employee_sensitive where employee_id = emp;

  insert into public.audit_log (actor, action, target_id, target_table, column_name)
    values (auth.uid(), 'read_ssn_full', emp, 'employee_sensitive', 'ssn_enc');

  return v;
end;
$$;

revoke execute on function public.get_ssn_full(uuid) from public;
grant execute on function public.get_ssn_full(uuid) to authenticated; -- 함수 내부에서 is_hr() 재확인

-- [정책 변경] 필드별 원본 조회("보이기" 버튼): 휴대폰·계좌는 기본 마스킹 유지, hr 가 이 RPC 로
-- 개별 필드 원본을 조회할 수 있다. ssn/addr/reg_addr/emergency 도 화이트리스트에 포함하되,
-- 표시정책상 화면에서 주로 쓰는 건 phone/salary_acct/expense_acct 다. 호출마다 감사로그 기록.
-- get_ssn_full 은 하위호환으로 남겨두되, 신규 개발은 reveal_sensitive_field(emp,'ssn') 로 통일 권장.
create or replace function public.reveal_sensitive_field(emp uuid, field text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key');
  v text;
begin
  if not public.is_hr() then raise exception 'forbidden'; end if;
  if k is null or k = '' then raise exception 'encryption key not set'; end if;
  -- 화이트리스트 (동적 SQL 금지, CASE 로만)
  select case field
    when 'phone' then pgp_sym_decrypt(phone_enc, k)
    when 'salary_acct' then pgp_sym_decrypt(salary_acct_enc, k)
    when 'expense_acct' then pgp_sym_decrypt(expense_acct_enc, k)
    when 'ssn' then pgp_sym_decrypt(ssn_enc, k)
    when 'emergency' then pgp_sym_decrypt(emergency_enc, k)
    when 'addr' then pgp_sym_decrypt(addr_enc, k)
    when 'reg_addr' then pgp_sym_decrypt(reg_addr_enc, k)
    else null end
  into v from public.employee_sensitive where employee_id = emp;
  if field not in ('phone','salary_acct','expense_acct','ssn','emergency','addr','reg_addr') then
    raise exception 'invalid field';
  end if;
  insert into public.audit_log(actor, action, target_id, target_table, column_name)
    values (auth.uid(), 'reveal', emp, 'employee_sensitive', field);
  return v;
end $$;

revoke execute on function public.reveal_sensitive_field(uuid, text) from public;
grant execute on function public.reveal_sensitive_field(uuid, text) to authenticated; -- 내부 is_hr 재확인

-- [보안 리뷰 반영] employee_sensitive 는 FORCE ROW LEVEL SECURITY 라서, 이 SECURITY DEFINER
-- 함수들이 실제로 값을 읽으려면 함수 소유자가 RLS 를 우회하는(BYPASSRLS, 통상 postgres 슈퍼유저)
-- 롤이어야 한다. 마이그레이션을 다른 롤로 실행했을 경우를 대비해 명시적으로 고정한다.
alter function public.get_sensitive_masked(uuid) owner to postgres;
alter function public.set_sensitive(uuid, jsonb) owner to postgres;
alter function public.get_ssn_full(uuid) owner to postgres;
alter function public.reveal_sensitive_field(uuid, text) owner to postgres;
