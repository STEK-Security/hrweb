-- 0028_groupware_id_and_full_ingest.sql
-- 그룹웨어 69컬럼을 "전부" 넣는다. 여태 54컬럼만 들어가던 것을 세 갈래로 나눠 해결한다.
--
--  (a) 그룹웨어ID(= 그룹 메일주소)를 employees 에 신설.
--      이건 민감값이 아니라 사내 디렉터리 식별자다. 모든 시스템의 메일 발송 기준이 이 값이고,
--      직원명부에도 보여야 하므로 employee_sensitive 가 아니라 employees 에 평문으로 둔다.
--      (개인메일 individualEmail 은 여전히 민감값 — employee_sensitive 로 간다. 둘을 헷갈리지 말 것.)
--
--  (b) 나머지 민감 14컬럼(주민번호·주소4·연락처2·계좌6·개인메일)은 설계대로 employee_sensitive
--      에 암호화 저장한다. 다만 지금까진 n8n 이 쓸 경로가 없어 그냥 버려지고 있었다 →
--      n8n_ingest 전용 SECURITY DEFINER RPC 를 하나 만든다.
--
--  (c) 8자리 사번이 1405-02-01 처럼 날짜로 망가져 저장된 기존 행 복구
--      (원인: 워커의 norm() 이 8자리 숫자면 무조건 날짜로 폈다. hr_groupware_checker.py 수정 완료)
--
-- 재실행 안전: 전부 IF NOT EXISTS / CREATE OR REPLACE / 조건부 UPDATE.

-- ============================================================
-- (a) 그룹웨어ID
-- ============================================================
alter table public.employees add column if not exists "그룹웨어ID" text;

-- 0006 에서 컬럼단위로 좁혀놨으므로 새 컬럼은 별도 GRANT 가 필요하다(0014 와 같은 이유).
grant select ("그룹웨어ID") on public.employees to authenticated;
grant insert ("그룹웨어ID") on public.employees to n8n_ingest;
grant update ("그룹웨어ID") on public.employees to n8n_ingest;

-- 메일 발송 기준 키라 조회가 잦다. 퇴직자 포함 전건이라 부분 인덱스로 충분.
create index if not exists employees_groupware_id_idx
  on public.employees ("그룹웨어ID") where "그룹웨어ID" is not null;

-- ============================================================
-- (c) 망가진 사번/그룹사원번호 복구  ★ (a) 다음, (b) 앞에 둬야 한다
--     — (b) RPC 가 사번으로 employees 를 찾으므로 먼저 정상화되어 있어야 한다.
-- ============================================================
-- 정상 사번 행이 이미 따로 있으면(재수집으로 생긴 중복) 망가진 쪽을 soft delete 한다.
-- 하드 삭제는 하지 않는다 — employee_transfers/training_records 등 하위 이력의 FK 가 물려 있다.
update public.employees d
   set deleted_at = coalesce(d.deleted_at, now())
 where d."사번" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   and exists (
     select 1 from public.employees c
      where c."사번" = replace(d."사번", '-', '') and c.id <> d.id
   );

-- 나머지는 제자리에서 사번만 복원(하이픈 제거). 위에서 걸러졌으므로 unique 충돌 없음.
update public.employees
   set "사번" = replace("사번", '-', '')
 where "사번" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   and deleted_at is null;

-- 그룹사원번호는 unique 가 아니라 그냥 편다.
update public.employees
   set "그룹사원번호" = replace("그룹사원번호", '-', '')
 where "그룹사원번호" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

-- ============================================================
-- (b) n8n 전용 민감값 인제스트 RPC
-- ============================================================
-- set_sensitive(uuid, jsonb) 와 같은 일을 하지만:
--   · 키가 사번(text)이다 — n8n 은 employees.id(uuid)를 모르고, SELECT 권한도 없다.
--   · is_hr() 대신 n8n_ingest 에게만 EXECUTE 를 준다(auth.uid() 가 없는 호출 주체라 is_hr() 불가).
--   · 배열을 한 번에 받는다 — 300명을 300번 호출하면 PostgREST 왕복만 300번이다.
--   · ★ 빈 값('' / null)은 기존 저장값을 덮지 않는다. 그룹웨어에서 한 필드가 일시적으로
--     비어 내려와도 이미 저장된 암호값을 날리지 않는다("기존 건 그대로, 바뀐 것만 갱신").
create or replace function public.n8n_upsert_sensitive(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  k        text := (select decrypted_secret from vault.decrypted_secrets where name = 'app_enc_key');
  r        jsonb;
  eid      uuid;
  updated  int := 0;
  unmatched int := 0;
begin
  if k is null or k = '' then
    -- fail-closed: 키가 없으면 평문으로 새는 것보다 실패가 낫다.
    raise exception 'encryption key not set (vault secret app_enc_key)';
  end if;
  if jsonb_typeof(payload) <> 'array' then
    raise exception 'payload must be a json array of rows';
  end if;

  for r in select value from jsonb_array_elements(payload) loop
    select e.id into eid
      from public.employees e
     where e."사번" = r->>'사번'
       and e.deleted_at is null
     limit 1;
    if eid is null then
      unmatched := unmatched + 1;
      continue;
    end if;

    insert into public.employee_sensitive (employee_id) values (eid)
      on conflict (employee_id) do nothing;

    update public.employee_sensitive set
      ssn_enc = case when nullif(r->>'ssn', '') is not null
        then pgp_sym_encrypt(r->>'ssn', k) else ssn_enc end,
      salary_acct_enc = case when r->'salary_acct' is not null and r->'salary_acct' <> 'null'::jsonb
        then pgp_sym_encrypt((r->'salary_acct')::text, k) else salary_acct_enc end,
      expense_acct_enc = case when r->'expense_acct' is not null and r->'expense_acct' <> 'null'::jsonb
        then pgp_sym_encrypt((r->'expense_acct')::text, k) else expense_acct_enc end,
      addr_enc = case when r->'addr' is not null and r->'addr' <> 'null'::jsonb
        then pgp_sym_encrypt((r->'addr')::text, k) else addr_enc end,
      reg_addr_enc = case when r->'reg_addr' is not null and r->'reg_addr' <> 'null'::jsonb
        then pgp_sym_encrypt((r->'reg_addr')::text, k) else reg_addr_enc end,
      phone_enc = case when nullif(r->>'phone', '') is not null
        then pgp_sym_encrypt(r->>'phone', k) else phone_enc end,
      emergency_enc = case when nullif(r->>'emergency', '') is not null
        then pgp_sym_encrypt(r->>'emergency', k) else emergency_enc end,
      email_enc = case when nullif(r->>'email', '') is not null
        then pgp_sym_encrypt(r->>'email', k) else email_enc end,
      updated_by = null,          -- n8n 은 auth.uid() 가 없다. 주체는 아래 감사로그의 action 으로 남는다.
      updated_at = now()
    where employee_id = eid;

    updated := updated + 1;
  end loop;

  -- 민감값을 쓴 사실은 반드시 남긴다(원본 값은 기록하지 않는다). 실행당 1행.
  insert into public.audit_log (actor, action, target_table, column_name)
    values (null, 'n8n_ingest_sensitive', 'employee_sensitive', updated || '/' || (updated + unmatched));

  return jsonb_build_object('updated', updated, 'unmatched_sabun', unmatched);
end;
$$;

-- employee_sensitive 는 FORCE ROW LEVEL SECURITY + 정책 0개다. 이 SECURITY DEFINER 함수가
-- 실제로 읽고 쓰려면 소유자가 RLS 를 우회하는 롤(BYPASSRLS, 통상 postgres)이어야 한다.
-- 0005 의 4개 함수와 동일한 이유 — 다른 롤로 마이그레이션을 적용한 경우를 대비해 명시 고정.
alter function public.n8n_upsert_sensitive(jsonb) owner to postgres;

revoke execute on function public.n8n_upsert_sensitive(jsonb) from public;
revoke execute on function public.n8n_upsert_sensitive(jsonb) from anon, authenticated;
grant execute on function public.n8n_upsert_sensitive(jsonb) to n8n_ingest;

-- 위 RPC 가 남기는 감사로그는 actor 가 null 이라 "audit insert self"(actor = auth.uid()) 를
-- 통과하지 못한다. FORCE RLS 라 SECURITY DEFINER 여도 정책이 적용되므로 전용 정책을 둔다.
-- action 을 못 박고 민감 원본은 애초에 담기지 않으므로, 위조돼도 로그 노이즈가 전부다.
drop policy if exists "audit n8n ingest" on public.audit_log;
create policy "audit n8n ingest" on public.audit_log
  for insert
  with check (actor is null and action = 'n8n_ingest_sensitive');

-- 명시적 재확인: employee_sensitive 테이블 자체에는 여전히 n8n_ingest 권한이 0 이다.
-- (쓰기는 위 SECURITY DEFINER RPC 를 통해서만 일어나고, 읽기 경로는 아예 없다.)
revoke all on public.employee_sensitive from n8n_ingest;
