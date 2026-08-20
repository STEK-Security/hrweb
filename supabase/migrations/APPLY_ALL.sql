-- APPLY_ALL.sql
-- Studio SQL 편집기에 이 파일 전체를 복붙해 한 번에 실행하기 위한 파일.
-- 0001_roles.sql ~ 0010_n8n_role.sql 을 순서대로 이어붙인 것과 동일하다.
--
-- ============================================================
-- 실행 전 주의사항
-- ============================================================
-- 1) 이 파일은 스키마/RLS/함수/롤 생성만 한다. 데모 데이터는 넣지 않는다(별도 Phase 7 seed).
-- 2) 암호화 키는 Supabase Vault 로 관리한다(클라이언트는 절대 주입하지 않는다). 이 SQL 을
--    실행한 뒤 Studio SQL 편집기에서 관리자가 1회:
--      -- 암호화 키 등록 (Studio SQL editor 에서 1회). '<강한 키>' 를 실제 값으로.
--      select vault.create_secret('<강한 키>', 'app_enc_key');
--      -- 키 회전: select vault.update_secret((select id from vault.secrets where name='app_enc_key'), '<새 키>');
--    (v1 은 `alter role authenticator set app.enc_key=...` 를 시도했으나 Supabase 의 postgres 롤이
--    슈퍼유저가 아니라서 42501 permission denied 로 실패함 — Vault 가 없는 self-host 대비 대체안은
--    0005_sensitive_rpc.sql 상단 주석과 supabase/README.md 2절 참고.)
-- 3) 최초 시스템관리자 계정은 이 SQL 로 만들지 않는다. supabase Auth 로 계정 생성 후
--    `update public.user_roles set role='시스템관리자' where user_id='<uuid>';` 를 admin 세션에서 직접 실행한다
--    (self-write 금지 정책 때문에 본인 계정으로는 자신을 admin 으로 못 올린다 — 이건 의도된 동작).
-- 4) 전체를 한 번에 실행해도 되고, 문제가 생기면 0001 부터 파일 단위로 순서대로 실행해도 된다.
-- 5) 민감정보 표시정책: 개인메일은 전체 표시(마스킹 없음), 휴대폰/급여계좌/경비계좌는 기본
--    마스킹 + hr 이 reveal_sensitive_field(emp,field) 로 "보이기" 가능, 주민번호/주소/비상연락망은
--    마스킹 유지(주민번호 원본은 get_ssn_full 또는 reveal_sensitive_field(emp,'ssn')).
-- ============================================================

-- ============================================================
-- 0001_roles.sql
-- ============================================================
-- 0001_roles.sql
-- 역할 소스: user_roles (사용자 self-write 금지). 헬퍼 함수는 SECURITY DEFINER + search_path 고정.
-- 이 파일은 supabase Studio SQL 편집기에서 그대로 실행 가능하다.

-- [보안 리뷰 반영] 앞으로 이 롤(통상 postgres)이 public 스키마에 만드는 모든 신규 테이블은,
-- 개별 마이그레이션에서 명시적으로 grant 하기 전까지 anon/authenticated 에게 기본 권한이
-- 전혀 생기지 않는다. "깜빡하고 GRANT 를 안 좁힌 새 테이블이 그대로 노출"되는 사고를 원천 차단.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 역할은 user_roles 로만 관리한다. profiles/JWT 어디에도 role 을 이중으로 두지 않는다.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('시스템관리자','인사담당자','팀장','일반')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
revoke all on public.user_roles from anon, authenticated;

-- 헬퍼 함수: SECURITY DEFINER + search_path 고정으로 role 상승/우회를 막는다.
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = '시스템관리자'
$$;

create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('시스템관리자','인사담당자')
$$;

revoke execute on function public.current_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_hr() from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_hr() to authenticated;

-- user_roles 는 admin 만 쓰기, 본인은 자기 role 읽기만 가능(self-write 금지).
create policy "roles admin all" on public.user_roles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "roles self read" on public.user_roles
  for select
  using (user_id = auth.uid());

grant select on public.user_roles to authenticated;


-- ============================================================
-- 0002_profiles.sql
-- ============================================================
-- 0002_profiles.sql
-- 계정 프로필. role 은 여기 없음(0001 user_roles 가 유일 소스).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  dept text,
  team text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from anon, authenticated;

grant select (id, email, name, dept, team, enabled) on public.profiles to authenticated;
grant update (name, dept, team) on public.profiles to authenticated;

-- 본인은 본인 행 + hr 은 전체 조회
create policy "profiles self read" on public.profiles
  for select
  using (id = auth.uid() or public.is_hr());

-- 본인은 비민감 필드만 수정(role 없음 = 자기승격 불가)
create policy "profiles self update" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles admin all" on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- auth.users 신규 생성 시 profiles/user_roles 기본행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, '일반')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 0003_employees.sql
-- ============================================================
-- 0003_employees.sql
-- 직원 기본정보(엑셀 비민감 컬럼만). 컬럼명은 엑셀 헤더와 1:1로 맞춰 화면/derive.ts 매핑 비용을 없앤다.
-- 민감값(주민번호·계좌·주소·연락처·개인메일)은 여기 없음 → 0004_sensitive.sql 참조.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- 본인 매칭용(nullable)

  "성명" text not null,
  "영문성명" text,
  "닉네임" text,
  "사번" text not null unique,
  "그룹사원번호" text,
  "법인" text,
  "소속" text,
  "전체소속명" text,
  "직책" text,
  "직급" text,
  "고용구분" text,
  "근무지" text,

  "입사일" date,
  "그룹입사일" date,
  "퇴직일" date,
  "퇴직사유" text,
  "근속연수(그룹입사일)" numeric,
  "근속연수(입사일)" numeric,

  "발령명" text,
  "입사경로" text,
  "추천인" text,
  "인정경력(년)" numeric,
  "인정경력(월)" numeric,

  "성별" text,
  "생년월일" date,
  "나이(만)" integer,
  "결혼여부" text,
  "음양구분" text,
  "생일" text,

  "학력" text,
  "학교" text,
  "학위" text,
  "전공" text,

  "역종" text,
  "군별" text,
  "계급" text,
  "병역특례여부" text,
  "장애여부" text,
  "보훈대상자" text,

  "국적" text,
  "내/외국인" text,
  "거주지국" text,
  "체류자격" text,
  "체류시작일" date,
  "체류종료일" date,

  "근태기준일" date,
  "퇴직기준일" date,
  "최종이동일" date,
  "최종보임일" date,
  "직무변경일" date,
  "직종전환일" date,

  "계약시작일" date,
  "계약종료일" date,
  "수습종료일" date
);

-- 팀장→팀 매핑(self-write 금지: hr/admin 만 기록, 팀장은 자기 매핑만 읽음)
create table if not exists public.team_managers (
  manager_id uuid not null references auth.users(id) on delete cascade,
  team text not null,
  primary key (manager_id, team)
);

alter table public.employees enable row level security;
alter table public.employees force row level security;
revoke all on public.employees from anon, authenticated;
-- 컬럼단위 GRANT 는 0006_column_grants.sql 에서 명시적으로 좁힌다. 여기서는 임시 테이블-단위 select 만.
grant select, insert, update, delete on public.employees to authenticated;

alter table public.team_managers enable row level security;
alter table public.team_managers force row level security;
revoke all on public.team_managers from anon, authenticated;
grant select on public.team_managers to authenticated;

-- employees RLS: hr 전체 CRUD, 팀장 자기 팀 조회, 본인 조회. INSERT/UPDATE/DELETE 는 hr 정책으로만 커버된다.
create policy "emp hr all" on public.employees
  for all
  using (public.is_hr())
  with check (public.is_hr());

create policy "emp mgr read" on public.employees
  for select
  using ("소속" in (select team from public.team_managers where manager_id = auth.uid()));

create policy "emp self read" on public.employees
  for select
  using (user_id = auth.uid());

-- team_managers RLS: hr/admin 만 쓰기, 팀장 본인 매핑만 읽음(self-write 금지)
create policy "team_managers hr all" on public.team_managers
  for all
  using (public.is_hr())
  with check (public.is_hr());

create policy "team_managers self read" on public.team_managers
  for select
  using (manager_id = auth.uid());


-- ============================================================
-- 0004_sensitive.sql
-- ============================================================
-- 0004_sensitive.sql
-- 민감값 분리 + 암호화 저장. employees 와 완전히 분리된 테이블이며,
-- anon/authenticated 에게 어떤 GRANT·정책도 주지 않는다(직접 SELECT 불가).
-- 접근은 오직 0005_sensitive_rpc.sql 의 SECURITY DEFINER RPC 로만 가능하다.

create extension if not exists pgcrypto;

create table if not exists public.employee_sensitive (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  ssn_enc bytea,           -- 주민번호
  salary_acct_enc bytea,   -- 급여계좌(은행/계좌번호/예금주 를 jsonb 로 암호화)
  expense_acct_enc bytea,  -- 경비계좌(은행/계좌번호/예금주 를 jsonb 로 암호화)
  addr_enc bytea,          -- 현주소(우편번호/주소 를 jsonb 로 암호화)
  reg_addr_enc bytea,      -- 등본주소(우편번호/주소 를 jsonb 로 암호화)
  phone_enc bytea,         -- 휴대폰번호
  emergency_enc bytea,     -- 비상연락망
  email_enc bytea,         -- 개인메일
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.employee_sensitive enable row level security;
alter table public.employee_sensitive force row level security;

-- 의도적으로 GRANT·정책 없음: anon/authenticated 는 직접 select/insert/update/delete 전부 불가.
revoke all on public.employee_sensitive from anon, authenticated;
revoke all on public.employee_sensitive from public;
-- (정책을 만들지 않음 = RLS 하에서 모든 행이 기본 차단. 오직 테이블 소유자(SECURITY DEFINER 함수 실행 주체)만 우회 가능.)


-- ============================================================
-- 0005_sensitive_rpc.sql
-- ============================================================
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

-- [정책 변경] 필드별 원본 조회("보이기" 버튼): 휴대폰·계좌는 기본 마스킹 유지, hr 가 이 RPC 로
-- 개별 필드 원본을 조회할 수 있다. ssn/addr/reg_addr/emergency 도 화이트리스트에 포함하되,
-- 표시정책상 화면에서 주로 쓰는 건 phone/salary_acct/expense_acct 다. 호출마다 감사로그 기록.
-- get_ssn_full 은 하위호환으로 남겨두되, 신규 개발은 reveal_sensitive_field(emp,'ssn') 로 통일 권장.
create or replace function public.reveal_sensitive_field(emp uuid, field text)
returns text
language plpgsql
security definer
set search_path = public
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


-- ============================================================
-- 0006_column_grants.sql
-- ============================================================
-- 0006_column_grants.sql
-- 최소 GRANT 원칙: 0003 에서 준 테이블 단위 select 를 걷어내고, 명시적 컬럼 목록으로 좁힌다.
-- employees 의 핵심 민감값(주민번호·계좌·주소·연락처·개인메일)은 이미 employee_sensitive 로
-- 완전히 분리되어 있어 employees 자체에는 준민감 컬럼이 남아있지 않다. 그래도 "필요한 컬럼만
-- 명시적으로 grant" 원칙을 지키기 위해 와일드카드 select 대신 전체 컬럼을 나열한다.
-- (주의) hr/팀장/일반의 실제 차등 접근은 컬럼 GRANT 가 아니라 0003 의 행단위 RLS 정책이
-- 담당한다 — 이들은 모두 동일한 Postgres 롤 `authenticated` 를 공유하므로 컬럼 GRANT 로는
-- hr 대 일반을 구분할 수 없다(Postgres 는 컬럼단위 RLS 를 지원하지 않는다).

revoke select on public.employees from authenticated;

grant select (
  id, user_id,
  "성명", "영문성명", "닉네임", "사번", "그룹사원번호",
  "법인", "소속", "전체소속명", "직책", "직급", "고용구분", "근무지",
  "입사일", "그룹입사일", "퇴직일", "퇴직사유",
  "근속연수(그룹입사일)", "근속연수(입사일)",
  "발령명", "입사경로", "추천인", "인정경력(년)", "인정경력(월)",
  "성별", "생년월일", "나이(만)", "결혼여부", "음양구분", "생일",
  "학력", "학교", "학위", "전공",
  "역종", "군별", "계급", "병역특례여부", "장애여부", "보훈대상자",
  "국적", "내/외국인", "거주지국", "체류자격", "체류시작일", "체류종료일",
  "근태기준일", "퇴직기준일", "최종이동일", "최종보임일", "직무변경일", "직종전환일",
  "계약시작일", "계약종료일", "수습종료일"
) on public.employees to authenticated;


-- ============================================================
-- 0007_leave.sql
-- ============================================================
-- 0007_leave.sql
-- 휴직 관리(엑셀에 없던 신규 테이블). 기존 LeaveManagement 화면 형식과 동일한 컬럼셋.

create table if not exists public.leave_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  name text not null,
  dept text,
  position text,
  reason text,
  start_date date,
  expected_return_date date,
  substitute_assigned boolean not null default false,
  substitute_name text,
  contact text,
  status text not null default '휴직중' check (status in ('휴직중','복직예정','복직완료')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leave_records enable row level security;
alter table public.leave_records force row level security;
revoke all on public.leave_records from anon, authenticated;
grant select, insert, update, delete on public.leave_records to authenticated;

-- hr 전체 CRUD
create policy "leave hr all" on public.leave_records
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- 팀장: 본인 팀 조회만
create policy "leave mgr read" on public.leave_records
  for select
  using (dept in (select team from public.team_managers where manager_id = auth.uid()));

-- 일반: 본인(employees.user_id 매칭) 조회만
create policy "leave self read" on public.leave_records
  for select
  using (
    employee_id in (select id from public.employees where user_id = auth.uid())
  );


-- ============================================================
-- 0008_settings.sql
-- ============================================================
-- 0008_settings.sql
-- 조직·기준·기능토글 설정. 보안판단(RLS 조건)에는 절대 사용하지 않는다 — role 판단은
-- 오직 user_roles/is_admin()/is_hr() 로만 한다. 여기는 UI/동작 토글 용도.

create table if not exists public.org_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;
alter table public.org_settings force row level security;
revoke all on public.org_settings from anon, authenticated;
grant select on public.org_settings to authenticated;
grant insert, update, delete on public.org_settings to authenticated; -- RLS 로 admin 만 실제 통과

create policy "settings authenticated read" on public.org_settings
  for select
  using (true);

create policy "settings admin write" on public.org_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 초기값: 규칙값 + 기능 토글 (n8n 도 REST 로 읽어서 동작 분기 가능)
insert into public.org_settings (key, value) values
  ('probation_days', '{"first": 30, "final": 55}'::jsonb),
  ('retire_age', '60'::jsonb),
  ('exclude_pattern', '["테스트", "test", "GPRO"]'::jsonb),
  ('org_name_map', '{"총괄": "TBS"}'::jsonb),
  ('employee_input_enabled', 'true'::jsonb),
  ('leave_input_enabled', 'true'::jsonb)
on conflict (key) do nothing;


-- ============================================================
-- 0009_audit.sql
-- ============================================================
-- 0009_audit.sql
-- 감사로그: 누가/언제/무엇을(테이블·행·컬럼) 만. 민감 원본 값은 절대 기록하지 않는다.
-- append-only: update/delete 는 전부 차단.

create table if not exists public.audit_log (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target_id uuid,
  target_table text,
  column_name text,
  ts timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on public.audit_log from anon, authenticated;
grant select, insert on public.audit_log to authenticated;

-- 누구나(로그인 사용자) 자기 자신을 actor 로 하는 행만 insert 가능
create policy "audit insert self" on public.audit_log
  for insert
  with check (actor = auth.uid());

-- 조회는 admin 만
create policy "audit admin select" on public.audit_log
  for select
  using (public.is_admin());

-- append-only: update/delete 는 명시적으로 전부 차단
create policy "audit no update" on public.audit_log
  for update
  using (false);

create policy "audit no delete" on public.audit_log
  for delete
  using (false);


-- ============================================================
-- 0010_n8n_role.sql
-- ============================================================
-- 0010_n8n_role.sql
-- n8n 전용 최소권한 롤. service_role 은 절대 사용하지 않는다.
-- employees/leave_records 의 insert/update 만 가능하고, SELECT 와 employee_sensitive 는
-- 아무 권한도 없다(민감값은 n8n 경로로 절대 못 읽는다). insert/update 도 테이블 단위가 아니라
-- 컬럼단위 GRANT 다 — id/user_id(employees), id/employee_id(leave_records) 같은 PK·FK·링킹
-- 컬럼은 제외해, 침해 시 n8n_ingest 로 임의 auth 계정에 직원행을 연결하는 걸 막는다.
--
-- 연결 방식: n8n 이 이 DB 자격증명을 직접 들지 않는 것이 이상적이나(별도 인제스트
-- Edge Function + HMAC 토큰 권장, 스펙 8절 P0-4), 이 마이그레이션은 최소한의 DB 롤
-- 안전장치로 이 롤을 만든다. NOLOGIN 이므로 이 롤 자체로 직접 접속하지 않고,
-- PostgREST 의 `authenticator` 가 요청의 역할 클레임에 따라 `set role n8n_ingest` 로
-- 전환하는 방식(또는 신뢰된 서버측 연결 사용자가 `set role`)으로만 사용한다.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'n8n_ingest') then
    create role n8n_ingest nologin noinherit;
  end if;
end
$$;

grant usage on schema public to n8n_ingest;

-- authenticator 가 이 롤로 전환(set role)할 수 있게 허용. authenticator 가 없는 환경(로컬)에서는 무시.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant n8n_ingest to authenticator';
  end if;
end
$$;

-- [보안 리뷰 반영] employees.id/user_id, leave_records.id/employee_id 는 컬럼단위 GRANT 에서
-- 제외한다. user_id 를 n8n 이 임의로 쓸 수 있으면(테이블단위 grant 였을 때) 침해 시 남의
-- auth 계정과 직원행을 연결해 "emp self read" RLS 를 우회당할 수 있었다. id/employee_id 는
-- FK·PK 라 n8n 인제스트가 건드릴 이유가 없는 링킹 컬럼이라 함께 제외한다.
revoke insert, update on public.employees from n8n_ingest;
revoke insert, update on public.leave_records from n8n_ingest;

grant insert (
  "성명", "영문성명", "닉네임", "사번", "그룹사원번호",
  "법인", "소속", "전체소속명", "직책", "직급", "고용구분", "근무지",
  "입사일", "그룹입사일", "퇴직일", "퇴직사유",
  "근속연수(그룹입사일)", "근속연수(입사일)",
  "발령명", "입사경로", "추천인", "인정경력(년)", "인정경력(월)",
  "성별", "생년월일", "나이(만)", "결혼여부", "음양구분", "생일",
  "학력", "학교", "학위", "전공",
  "역종", "군별", "계급", "병역특례여부", "장애여부", "보훈대상자",
  "국적", "내/외국인", "거주지국", "체류자격", "체류시작일", "체류종료일",
  "근태기준일", "퇴직기준일", "최종이동일", "최종보임일", "직무변경일", "직종전환일",
  "계약시작일", "계약종료일", "수습종료일"
) on public.employees to n8n_ingest;

grant update (
  "성명", "영문성명", "닉네임", "사번", "그룹사원번호",
  "법인", "소속", "전체소속명", "직책", "직급", "고용구분", "근무지",
  "입사일", "그룹입사일", "퇴직일", "퇴직사유",
  "근속연수(그룹입사일)", "근속연수(입사일)",
  "발령명", "입사경로", "추천인", "인정경력(년)", "인정경력(월)",
  "성별", "생년월일", "나이(만)", "결혼여부", "음양구분", "생일",
  "학력", "학교", "학위", "전공",
  "역종", "군별", "계급", "병역특례여부", "장애여부", "보훈대상자",
  "국적", "내/외국인", "거주지국", "체류자격", "체류시작일", "체류종료일",
  "근태기준일", "퇴직기준일", "최종이동일", "최종보임일", "직무변경일", "직종전환일",
  "계약시작일", "계약종료일", "수습종료일"
) on public.employees to n8n_ingest;

grant insert (
  name, dept, position, reason, start_date, expected_return_date,
  substitute_assigned, substitute_name, contact, status, created_at, updated_at
) on public.leave_records to n8n_ingest;

grant update (
  name, dept, position, reason, start_date, expected_return_date,
  substitute_assigned, substitute_name, contact, status, created_at, updated_at
) on public.leave_records to n8n_ingest;

-- RLS: n8n_ingest 롤 전용 insert/update 정책 (해당 롤은 is_hr()/user_roles 매칭 대상이 아니므로 별도 정책 필요)
create policy "n8n insert employees" on public.employees
  for insert
  to n8n_ingest
  with check (true);

create policy "n8n update employees" on public.employees
  for update
  to n8n_ingest
  using (true)
  with check (true);

create policy "n8n insert leave" on public.leave_records
  for insert
  to n8n_ingest
  with check (true);

create policy "n8n update leave" on public.leave_records
  for update
  to n8n_ingest
  using (true)
  with check (true);

-- 명시적 재확인: employee_sensitive 에는 n8n_ingest 에 대한 어떤 GRANT 도 주지 않는다.
revoke all on public.employee_sensitive from n8n_ingest;


