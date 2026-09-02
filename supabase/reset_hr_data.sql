-- supabase/reset_hr_data.sql
--
-- HR 데이터 전체 초기화 — 실데이터 재적재 전에 한 번 실행한다.
-- 실행: Supabase Studio → SQL Editor (postgres 롤, RLS 우회) 또는
--       psql "$SUPABASE_DB_URL" -f supabase/reset_hr_data.sql
--
-- ⚠ 되돌릴 수 없다. 실행 전 백업:
--       pg_dump "$SUPABASE_DB_URL" -n public -Fc -f hr_backup_$(date +%F).dump
--
-- 남기는 것(기본): profiles / user_roles(로그인 계정), org_settings(분류기준 등), audit_log(감사기록)
--   → 같이 지우려면 아래 "선택 블록" 주석을 해제한다.
--
-- 주의: 0023 / 0025 / 0026 마이그레이션은 데모 시드다. 초기화 후 마이그레이션을
--       다시 돌리면 데모 데이터가 되살아난다.

begin;

-- 확장 마이그레이션(0016~0024)이 일부만 적용된 DB 도 있어서, 존재하는 테이블만 골라
-- 한 문장으로 truncate 한다(한 문장이라 FK 순서를 신경 쓸 필요가 없다).
-- cascade: 여기 나열되지 않은 참조 테이블까지 함께 비운다(설계상 전부 employees 종속).
do $$
declare
  targets text[] := array[
    'employee_sensitive', 'employee_transfers', 'leave_records', 'leave_consult_logs',
    'evaluations', 'training_records', 'training_courses', 'hr_events', 'hr_checklists',
    'payroll_monthly', 'department_productivity', 'mail_queue', 'team_managers', 'employees'
  ];
  present text[];
  t text;
begin
  foreach t in array targets loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice '건너뜀(테이블 없음): %', t;
    else
      present := present || format('public.%I', t);
    end if;
  end loop;

  if present is null then
    raise exception '초기화 대상 테이블이 하나도 없다 — 마이그레이션이 적용된 DB 인지 확인할 것';
  end if;

  execute 'truncate table ' || array_to_string(present, ', ') || ' restart identity cascade';
end $$;

-- ── 선택 블록 ───────────────────────────────────────────────
-- 설정(분류기준·조직설정)까지 초기값으로 되돌린다 → 0008/0027 마이그레이션 재적용 필요
-- truncate table public.org_settings restart identity;
--
-- 감사로그까지 삭제(권장하지 않음 — 보존 의무 확인할 것)
-- truncate table public.audit_log restart identity;
--
-- 로그인 계정/권한까지 삭제(auth.users 는 Studio → Authentication 에서 별도로 지운다)
-- truncate table public.user_roles, public.profiles restart identity cascade;
-- ────────────────────────────────────────────────────────────

commit;

-- 검증: 유지 대상 외에는 전부 0 이어야 한다.
-- (0002~0008 기본 마이그레이션 테이블만 조회한다 — 확장 테이블은 없는 DB 가 있어서)
select 'employees' t, count(*) from public.employees
union all select 'employee_sensitive', count(*) from public.employee_sensitive
union all select 'leave_records', count(*) from public.leave_records
union all select 'org_settings(유지)', count(*) from public.org_settings
union all select 'profiles(유지)', count(*) from public.profiles
order by 1;
