-- 0010_n8n_role.sql
-- n8n 전용 최소권한 롤. service_role 은 절대 사용하지 않는다.
-- employees/leave_records 의 insert/update 만 가능하고, SELECT 와 employee_sensitive 는
-- 아무 권한도 없다(민감값은 n8n 경로로 절대 못 읽는다).
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

-- employees: insert/update 만. select 없음. employee_sensitive 권한 없음(기본 REVOKE 유지).
grant insert, update on public.employees to n8n_ingest;
grant insert, update on public.leave_records to n8n_ingest;

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
