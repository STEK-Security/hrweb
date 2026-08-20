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
