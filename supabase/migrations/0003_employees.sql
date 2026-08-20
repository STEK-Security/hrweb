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
