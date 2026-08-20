-- 0005_sensitive_rpc.sql
-- employee_sensitive 접근은 이 3개 SECURITY DEFINER RPC 로만 이뤄진다.
-- 암호화 키는 DB 밖에서 세션 변수로 주입한다: RPC 호출 세션에서
--   select set_config('app.enc_key', '<키>', true);
-- 를 먼저 실행해야 한다(같은 커넥션/트랜잭션 내에서만 유효, true = 트랜잭션 로컬).
-- Studio SQL 편집기에서 RPC 를 테스트할 때도 동일하게 먼저 주입해야 한다.

-- 마스킹 조회: hr(인사담당자/시스템관리자)만 호출 가능. 8개 민감항목 전부 마스킹해서 반환.
create or replace function public.get_sensitive_masked(emp uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  k text := current_setting('app.enc_key', true);
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
    'ssn', case when r.ssn_enc is null then null
      else '******-' || right(pgp_sym_decrypt(r.ssn_enc, k), 7) end,

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
  k text := current_setting('app.enc_key', true);
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
  k text := current_setting('app.enc_key', true);
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
