-- hotfix_0011_enckey_vault.sql
-- 이미 APPLY_ALL.sql(구버전, GUC 방식)을 실행해서 get_sensitive_masked/set_sensitive/
-- get_ssn_full 이 `current_setting('app.enc_key', true)` 버전으로 만들어져 있는 경우를 위한
-- 단독 hotfix. 이 파일만 Studio SQL 편집기에 붙여 실행하면 3개 함수가 Vault 버전으로 교체된다.
--
-- 실행 전, 아직 키를 Vault 에 등록하지 않았다면 먼저 1회:
--   select vault.create_secret('<강한 키>', 'app_enc_key');
-- (키 회전: select vault.update_secret((select id from vault.secrets where name='app_enc_key'), '<새 키>');)
--
-- 배경: `alter role authenticator set app.enc_key=...` 방식은 Supabase 의 postgres 롤이
-- 슈퍼유저가 아니라서 `42501 permission denied to set parameter` 로 실패한다. 이 hotfix 는
-- 0005_sensitive_rpc.sql 의 최신 버전(Vault 사용)과 동일한 내용이다 — 신규로 처음부터
-- 적용하는 경우라면 이 파일 대신 최신 APPLY_ALL.sql/0005_sensitive_rpc.sql 을 쓰면 된다.

-- 마스킹 조회: hr(인사담당자/시스템관리자)만 호출 가능. 8개 민감항목 전부 마스킹해서 반환.
create or replace function public.get_sensitive_masked(emp uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
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

    'email', case when r.email_enc is null then null
      else left(split_part(pgp_sym_decrypt(r.email_enc, k), '@', 1), 2) || '***@' ||
           split_part(pgp_sym_decrypt(r.email_enc, k), '@', 2) end
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
set search_path = public
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
set search_path = public
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

-- [보안 리뷰 반영] employee_sensitive 는 FORCE ROW LEVEL SECURITY 라서, 이 SECURITY DEFINER
-- 함수들이 실제로 값을 읽으려면 함수 소유자가 RLS 를 우회하는(BYPASSRLS, 통상 postgres 슈퍼유저)
-- 롤이어야 한다. 마이그레이션을 다른 롤로 실행했을 경우를 대비해 명시적으로 고정한다.
alter function public.get_sensitive_masked(uuid) owner to postgres;
alter function public.set_sensitive(uuid, jsonb) owner to postgres;
alter function public.get_ssn_full(uuid) owner to postgres;
