-- supabase/seed/demo_seed.sql
--
-- 데모 시드 — 검증용. Studio SQL 편집기에서 postgres 롤(RLS 우회)로 실행한다.
-- 엑셀 "인사기초정보_데모데이터.xlsx" 10명을 employees(비민감)에 그대로 넣고,
-- employee_sensitive(주민번호·계좌·주소·휴대폰·비상연락망·개인메일)는
-- **명백한 가짜값**만 암호화해서 넣는다. 실제 형식·실값은 절대 넣지 않는다.
--
-- 전제:
--   1) supabase/migrations/0001~0010 (또는 APPLY_ALL.sql) 이 먼저 적용되어 있어야 한다.
--   2) 암호화 키가 Vault 에 등록돼 있어야 한다(0005_sensitive_rpc.sql 상단 참고):
--        select vault.create_secret('<강한 키>', 'app_enc_key');
--      키가 없으면 아래 employee_sensitive INSERT 는 "encryption key not set" 이 아니라
--      pgp_sym_encrypt 자체가 k 를 그대로 문자열로 써서 암호화하므로 실패하지 않지만,
--      이후 get_sensitive_masked()/reveal_sensitive_field() RPC 호출은 Vault 값과 달라
--      복호화에 실패한다 — 반드시 먼저 Vault 키를 등록한 뒤 이 파일을 실행할 것.
--
-- 재실행 안전: employees 는 "사번" unique 로 on conflict do nothing, employee_sensitive 는
-- employee_id PK 로 on conflict do nothing, leave_records 는 자연키가 없어 이미 존재하는
-- (employee_id, reason) 조합이면 재삽입하지 않도록 not exists 로 가드한다.
-- 완전히 새로 넣고 싶으면(값 갱신 목적) 아래를 먼저 실행한다:
--   -- truncate public.leave_records;
--   -- truncate public.employee_sensitive;
--   -- delete from public.employees where "사번" in ('20180045','20150012','20230078','20190033','20210056','20170089','20220041','20080021','20240015','20200029');

-- ============================================================
-- 1) employees — 비민감 컬럼. 엑셀 실제 값 그대로.
-- ============================================================
insert into public.employees (
  "성명", "영문성명", "닉네임", "사번", "그룹사원번호", "법인", "소속", "전체소속명",
  "직책", "직급", "고용구분", "근무지",
  "입사일", "그룹입사일", "퇴직일", "퇴직사유", "근속연수(그룹입사일)", "근속연수(입사일)",
  "발령명", "입사경로", "추천인", "인정경력(년)", "인정경력(월)",
  "성별", "생년월일", "나이(만)", "결혼여부", "음양구분", "생일",
  "학력", "학교", "학위", "전공",
  "역종", "군별", "계급", "병역특례여부", "장애여부", "보훈대상자",
  "국적", "내/외국인", "거주지국", "체류자격", "체류시작일", "체류종료일",
  "근태기준일", "퇴직기준일", "최종이동일", "최종보임일", "직무변경일", "직종전환일",
  "계약시작일", "계약종료일", "수습종료일"
) values
('김민준', 'Minjun Kim', '민준', '20180045', 'G20180045', '스텍오토모티브', 'AI인프라팀', '스텍오토모티브 > 경영지원본부 > AI인프라팀', '선임', '선임', '정규직', '천안 본사', '2018-03-02', '2018-03-02', null, null, 8, 8, 'AI인프라팀 선임 발령', '공개채용', null, 2, 6, '남', '1990-01-01', 36, '기혼', '양력', '01-01', '대졸', '충남대학교', '학사', '컴퓨터공학', '예비역', '육군', '병장', 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2018-03-02', null, '2022-01-01', '2022-01-01', '2022-01-01', null, null, null, '2018-06-02'),
('이서연', 'Seoyeon Lee', '서연', '20150012', 'G20150012', '스텍오토모티브', '인사총무팀', '스텍오토모티브 > 경영지원본부 > 인사총무팀', '팀장', '차장', '정규직', '천안 본사', '2015-07-01', '2015-07-01', null, null, 11, 11, '인사총무팀 팀장 발령', '경력채용', '박지훈', 5, 0, '여', '1985-05-15', 41, '기혼', '양력', '05-15', '대졸', '이화여자대학교', '학사', '경영학', '해당없음', null, null, 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2015-07-01', null, '2021-03-01', '2023-01-01', '2021-03-01', null, null, null, '2015-10-01'),
('박도윤', 'Doyoon Park', '도윤', '20230078', 'G20230078', '스텍오토모티브', '생산관리팀', '스텍오토모티브 > 생산본부 > 생산관리팀', '사원', '사원', '정규직', '천안 공장', '2023-01-09', '2023-01-09', null, null, 3, 3, '생산관리팀 배치', '공개채용', null, 0, 0, '남', '1997-08-20', 29, '미혼', '음력', '08-20', '고졸', '천안공업고등학교', null, null, '예비역', '공군', '병장', 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2023-01-09', null, '2023-01-09', '2023-01-09', null, null, null, null, '2023-04-09'),
('최지아', 'Jia Choi', '지아', '20190033', 'G20190033', '스텍오토모티브', '품질관리팀', '스텍오토모티브 > 생산본부 > 품질관리팀', '과장', '과장', '정규직', '천안 공장', '2019-09-16', '2019-09-16', null, null, 7, 7, '품질관리팀 과장 승진', '경력채용', null, 3, 2, '여', '1992-03-10', 34, '미혼', '양력', '03-10', '대졸', '단국대학교', '학사', '화학공학', '해당없음', null, null, 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2019-09-16', null, '2022-07-01', '2024-01-01', '2022-07-01', null, null, null, '2019-12-16'),
('정하은', 'Haeun Jung', '하은', '20210056', 'G20210056', '스텍오토모티브', '해외영업팀', '스텍오토모티브 > 영업본부 > 해외영업팀', '대리', '대리', '정규직', '천안 본사', '2021-02-15', '2021-02-15', null, null, 5, 5, '해외영업팀 대리 승진', '공개채용', null, 1, 4, '여', '1994-06-22', 32, '미혼', '양력', '06-22', '대졸', '한국외국어대학교', '학사', '국제통상학', '해당없음', null, null, 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2021-02-15', null, '2021-02-15', '2023-06-01', null, null, null, null, '2021-05-15'),
('John Smith', 'John Smith', '존', '20170089', 'G20170089', 'STEK Automotive USA', 'North America Sales', 'STEK Automotive USA > Sales Division > North America Sales', '매니저', '과장', '정규직', '미국 법인', '2017-11-01', '2017-11-01', null, null, 9, 9, 'North America Sales 매니저 발령', '경력채용', null, 6, 0, '남', '1988-12-02', 37, '기혼', '양력', '12-02', '대졸', 'UC Berkeley', '학사', 'Business Administration', '해당없음', null, null, 'N', 'N', 'N', '미국', '외국인', '미국', null, null, null, '2017-11-01', null, '2020-05-01', '2020-05-01', '2020-05-01', null, null, null, '2018-02-01'),
('강태윤', 'Taeyoon Kang', '태윤', '20220041', 'G20220041', '스텍오토모티브', '네트워크보안팀', '스텍오토모티브 > 경영지원본부 > 네트워크보안팀', '주임', '주임', '계약직', '천안 본사', '2022-05-02', '2022-05-02', null, null, 4, 4, '네트워크보안팀 배치', '공개채용', null, 0, 8, '남', '1996-07-04', 30, '미혼', '양력', '07-04', '대졸', '공주대학교', '학사', '정보보안학', '예비역', '육군', '병장', 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2022-05-02', null, '2022-05-02', '2022-05-02', null, null, '2022-05-02', '2027-05-01', '2022-08-02'),
('윤소민', 'Somin Yoon', '소민', '20080021', 'G20080021', '스텍오토모티브', '재무회계팀', '스텍오토모티브 > 경영지원본부 > 재무회계팀', '부장', '부장', '정규직', '천안 본사', '2008-04-01', '2008-04-01', null, null, 18, 18, '재무회계팀 부장 승진', '공개채용', null, 4, 0, '여', '1978-02-15', 48, '기혼', '음력', '02-15', '대졸', '충북대학교', '학사', '회계학', '해당없음', null, null, 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2008-04-01', null, '2019-01-01', '2024-04-01', '2019-01-01', null, null, null, '2008-07-01'),
('한지훈', 'Jihoon Han', '지훈', '20240015', 'G20240015', '스텍오토모티브', '생산관리팀', '스텍오토모티브 > 생산본부 > 생산관리팀', '사원', '사원', '인턴', '천안 공장', '2024-07-01', '2024-07-01', null, null, 2, 2, '생산관리팀 인턴 배치', '인턴채용', null, 0, 0, '남', '1999-11-30', 26, '미혼', '양력', '11-30', '대재', '순천향대학교', null, '기계공학', '예비역', '해군', '병장', 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2024-07-01', null, '2024-07-01', '2024-07-01', null, null, '2024-07-01', '2025-06-30', null),
('오세영', 'Seyoung Oh', '세영', '20200029', 'G20200029', '스텍오토모티브', '연구개발팀', '스텍오토모티브 > 기술연구본부 > 연구개발팀', '연구원', '주임', '정규직', '천안 R&D센터', '2020-06-01', '2020-06-01', '2025-12-31', '개인사정(이직)', 5, 5, '연구개발팀 퇴직 처리', '경력채용', null, 2, 3, '여', '1993-04-18', 33, '미혼', '양력', '04-18', '대학원졸', 'KAIST', '석사', '화학소재공학', '해당없음', null, null, 'N', 'N', 'N', '대한민국', '내국인', '대한민국', null, null, null, '2020-06-01', '2025-12-31', '2022-09-01', '2022-09-01', '2022-09-01', null, null, null, '2020-09-01')
on conflict ("사번") do nothing;

-- ============================================================
-- 2) employee_sensitive — 가짜 민감값만 암호화 저장. 실제 형식·실값 금지.
--    set_sensitive() RPC 는 auth 컨텍스트(is_hr())가 없는 Studio 세션에서 호출하면
--    "forbidden" 이 나므로, 여기서는 postgres 롤로 직접 pgp_sym_encrypt 해서 INSERT 한다.
-- ============================================================
with k as (
  select decrypted_secret as v from vault.decrypted_secrets where name = 'app_enc_key'
),
emp as (
  select id, "사번", "성명" from public.employees
  where "사번" in ('20180045','20150012','20230078','20190033','20210056','20170089','20220041','20080021','20240015','20200029')
)
insert into public.employee_sensitive (
  employee_id, ssn_enc, salary_acct_enc, expense_acct_enc, addr_enc, reg_addr_enc, phone_enc, emergency_enc, email_enc
)
select
  e.id,
  pgp_sym_encrypt('000000-0000000', k.v),
  pgp_sym_encrypt(jsonb_build_object('bank', '가짜은행', 'number', '000-000000-000000', 'owner', e."성명")::text, k.v),
  pgp_sym_encrypt(jsonb_build_object('bank', '가짜은행', 'number', '000-000000-000000', 'owner', e."성명")::text, k.v),
  pgp_sym_encrypt(jsonb_build_object('postal', '00000', 'address', '가짜시 가짜구 가짜동 0-0')::text, k.v),
  pgp_sym_encrypt(jsonb_build_object('postal', '00000', 'address', '가짜시 가짜구 가짜동 0-0')::text, k.v),
  pgp_sym_encrypt('010-0000-0000', k.v),
  pgp_sym_encrypt('010-0000-0001(가짜비상연락처)', k.v),
  pgp_sym_encrypt(lower(e."사번") || '@example-demo.invalid', k.v)
from emp e, k
on conflict (employee_id) do nothing;

-- ============================================================
-- 3) leave_records — 엑셀에 없는 신규 테이블. 데모 5행(가상).
-- ============================================================
insert into public.leave_records (
  employee_id, name, dept, position, reason, start_date, expected_return_date,
  substitute_assigned, substitute_name, contact, status
)
select v.employee_id, v.name, v.dept, v.position, v.reason, v.start_date, v.expected_return_date,
       v.substitute_assigned, v.substitute_name, v.contact, v.status
from (
  select e.id as employee_id, '이서연' as name, '인사총무팀' as dept, '팀장' as position,
         '육아휴직' as reason, date '2026-03-01' as start_date, date '2027-02-28' as expected_return_date,
         true as substitute_assigned, '김민준' as substitute_name, '010-0000-1001' as contact, '휴직중' as status
  from public.employees e where e."사번" = '20150012'
  union all
  select e.id, '최지아', '품질관리팀', '과장',
         '질병휴직', date '2026-06-01', date '2026-09-30',
         false, null, '010-0000-1002', '휴직중'
  from public.employees e where e."사번" = '20190033'
  union all
  select e.id, '강태윤', '네트워크보안팀', '주임',
         '학업휴직', date '2025-09-01', date '2026-08-31',
         true, '박도윤', '010-0000-1003', '복직예정'
  from public.employees e where e."사번" = '20220041'
  union all
  select e.id, '정하은', '해외영업팀', '대리',
         '가족돌봄휴직', date '2025-01-01', date '2025-06-30',
         false, null, '010-0000-1004', '복직완료'
  from public.employees e where e."사번" = '20210056'
  union all
  select e.id, '윤소민', '재무회계팀', '부장',
         '기타휴직', date '2026-01-15', date '2026-04-15',
         true, '한지훈', '010-0000-1005', '복직완료'
  from public.employees e where e."사번" = '20080021'
) v
where not exists (
  select 1 from public.leave_records lr
  where lr.employee_id = v.employee_id and lr.reason = v.reason and lr.start_date = v.start_date
);
