-- APPLY_EXPANSION.sql
-- 전제: APPLY_ALL.sql(0001~0010) 이 이미 적용되어 있고, vault.create_secret('<강한 키>','app_enc_key')
-- 도 이미 1회 실행되어 있다(README 2절). 이 파일은 그 이후 확장분(0011~0014) 전체를 한 번에
-- 반영한다 — Studio SQL 편집기에 이 파일 전체를 그대로 복붙해 실행하면 된다.
--
-- 모든 문장이 IF EXISTS/IF NOT EXISTS/CREATE OR REPLACE 기반이라 재실행해도 안전하다.
-- 구성(순서 고정):
--   (a) 0011: 민감 RPC 4개 search_path=public,extensions 수정 + email 마스킹 해제 + reveal_sensitive_field
--   (b) 0012: user_roles 2역할(사용자/관리자) 전환 + is_hr/is_admin 재정의 + 팀장/일반 정책·team_managers 정리
--             + handle_new_user() role='사용자' 버그 수정(0012 를 개별 적용했다면 이미 반영됐을 수 있다)
--   (c) 0013: audit_log 컬럼 확장(ip/user_agent/meta/actor_email) + log_event RPC(서버측 IP 기록)
--   (d) 0014: employees/leave_records soft delete(deleted_at)
--
-- 개별 hotfix_0011~0014 파일은 그대로 남아있다(파일 단위로 하나씩 적용하고 싶을 때 사용).

-- ============================================================
-- (a) hotfix_0011_enckey_vault.sql
-- ============================================================

-- 마스킹 조회: hr(사용자/관리자)만 호출 가능. 8개 민감항목 전부 마스킹해서 반환.
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
      else pgp_sym_decrypt(r.email_enc, k) end
  );
end;
$$;

revoke execute on function public.get_sensitive_masked(uuid) from public;
grant execute on function public.get_sensitive_masked(uuid) to authenticated;

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

  insert into public.audit_log (actor, action, target_id, target_table, column_name)
    select auth.uid(), 'set_sensitive', emp, 'employee_sensitive', key
    from jsonb_object_keys(payload) as key;
end;
$$;

revoke execute on function public.set_sensitive(uuid, jsonb) from public;
grant execute on function public.set_sensitive(uuid, jsonb) to authenticated;

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
grant execute on function public.get_ssn_full(uuid) to authenticated;

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
grant execute on function public.reveal_sensitive_field(uuid, text) to authenticated;

alter function public.get_sensitive_masked(uuid) owner to postgres;
alter function public.set_sensitive(uuid, jsonb) owner to postgres;
alter function public.get_ssn_full(uuid) owner to postgres;
alter function public.reveal_sensitive_field(uuid, text) owner to postgres;

-- ============================================================
-- (b) hotfix_0012_two_roles.sql (2역할 + handle_new_user 버그 수정 포함)
-- ============================================================

alter table public.user_roles drop constraint if exists user_roles_role_check;

update public.user_roles set role = '관리자' where role = '시스템관리자';
update public.user_roles set role = '사용자' where role in ('인사담당자','팀장','일반');

alter table public.user_roles add constraint user_roles_role_check
  check (role in ('사용자','관리자'));

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = '관리자'
$$;

create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('사용자','관리자')
$$;

drop policy if exists "emp mgr read" on public.employees;
drop policy if exists "emp self read" on public.employees;
drop policy if exists "leave mgr read" on public.leave_records;
drop policy if exists "leave self read" on public.leave_records;

drop policy if exists "team_managers hr all" on public.team_managers;
drop policy if exists "team_managers self read" on public.team_managers;
drop table if exists public.team_managers;

-- [버그 수정] handle_new_user() 가 role='일반' 으로 만들면 위 CHECK 위반으로 신규 가입이 막힌다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, '사용자')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ============================================================
-- (c) hotfix_0013_audit_events.sql
-- ============================================================

alter table public.audit_log add column if not exists ip inet;
alter table public.audit_log add column if not exists user_agent text;
alter table public.audit_log add column if not exists meta jsonb;
alter table public.audit_log add column if not exists actor_email text;

create or replace function public.log_event(
  p_action text,
  p_target_id uuid default null,
  p_target_table text default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_headers jsonb;
  v_ip inet;
  v_ua text;
  v_actor_email text;
begin
  if p_action not in (
    'login_success','login_fail','logout','view_screen','view_employee',
    'create_employee','update_employee','delete_employee',
    'create_leave','update_leave','export','reveal','read_ssn_full','role_change'
  ) then
    raise exception 'invalid action';
  end if;

  if v_actor is null and p_action not in ('login_success','login_fail') then
    raise exception 'forbidden';
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    v_ua := v_headers ->> 'user-agent';
    begin
      v_ip := split_part(v_headers ->> 'x-forwarded-for', ',', 1)::inet;
    exception when others then
      v_ip := null;
    end;
  end if;

  v_actor_email := p_meta ->> 'email';

  insert into public.audit_log
    (actor, action, target_id, target_table, meta, ip, user_agent, actor_email)
  values
    (v_actor, p_action, p_target_id, p_target_table, p_meta, v_ip, v_ua, v_actor_email);
end;
$$;

alter function public.log_event(text, uuid, text, jsonb) owner to postgres;

revoke execute on function public.log_event(text, uuid, text, jsonb) from public;
grant execute on function public.log_event(text, uuid, text, jsonb) to authenticated, anon;

-- ============================================================
-- (d) hotfix_0014_soft_delete.sql
-- ============================================================

alter table public.employees add column if not exists deleted_at timestamptz;
alter table public.leave_records add column if not exists deleted_at timestamptz;

grant select (deleted_at) on public.employees to authenticated;
