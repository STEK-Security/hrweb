# STEK HR 웹앱 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클라이언트 엑셀 데모 앱을 supabase DB 기반 실서비스(로그인·명부·휴직·관리자)로 재설계한다.

**Architecture:** Approach A — 별도 백엔드 없음. React SPA 를 nginx(hr.stek.kr)가 서빙하고 `/auth /rest /storage /realtime` 를 supabase kong 으로 same-origin 프록시. 인증은 Supabase Auth, 접근제어는 RLS 가 유일 방어선. 민감값(주민번호·계좌)은 별도 테이블+암호화+마스킹 RPC. n8n 은 전용 최소권한 롤로 DB 직접 적재.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, @supabase/supabase-js, Supabase(Postgres+Auth+Kong), nginx, Dokploy.

**Spec:** docs/superpowers/specs/2026-08-19-hr-webapp-redesign-design.md

## Global Constraints

- 배포: 내부망 hr.stek.kr(자체서명→사내CA), Dokploy `frontend` app(GitHub hrweb, Dockerfile 빌드), autoDeploy on.
- `VITE_SUPABASE_URL=https://hr.stek.kr` (same-origin), `VITE_SUPABASE_ANON_KEY`=anon(공개). service_role 은 브라우저·n8n·git 어디에도 금지.
- 민감값(주민번호/급여·경비계좌/현·등본주소/휴대폰/비상연락망/개인메일)은 employees 에 평문 저장 금지 → `employee_sensitive`(암호화) + 마스킹 RPC 만.
- 모든 public 테이블 `enable + force row level security`. anon/authenticated 기본 GRANT 회수 후 필요한 컬럼만 grant.
- 데모 시드의 주민번호·계좌는 명백한 가짜값(`000000-0000000`)만. 실제 형식·실값 금지.
- 역할 4종: 시스템관리자|인사담당자|팀장|일반. role 은 사용자 self-write 불가.
- 커밋 자주. 각 마이그레이션은 `supabase/migrations/NNNN_*.sql` 순번.

---

## 파일 구조 (생성/수정/삭제)

**삭제(엑셀 데모 제거):**
- `src/mockData.ts`, `src/excel/adapt.ts`, `src/components/DataSourceView.tsx`, `src/components/SampleDataNotice.tsx`
- `src/components/LoginView.tsx`(데모계정) → supabase Auth 로그인으로 교체
- `인사자료/인사기초정보_데모데이터.xlsx` 는 시드 스크립트 입력으로만 쓰고 레포에서 최종 제거(시드 후)

**유지·재사용:**
- `src/excel/derive.ts`(분석 규칙: 제외·총괄→TBS·현장직·수습+30/+55·D-Day) → DB 행에 적용하도록 시그니처만 조정
- `src/components/Navbar.tsx`, `DashboardOverview.tsx`, `HeadcountAnalysis.tsx`, `LeaveManagement.tsx`, 모달들, `recharts` 시각화

**신규:**
- `supabase/migrations/*.sql` — 스키마·RLS·RPC·롤·시드
- `supabase/seed/seed.mjs` — 엑셀→DB 시드 스크립트(가짜 민감값)
- `src/lib/supabase.ts`(확장), `src/lib/auth.ts`(세션·역할), `src/lib/db.ts`(데이터 접근), `src/lib/rpc.ts`(마스킹 RPC 호출)
- `src/features/auth/LoginPage.tsx`, `src/features/admin/*`(Users, Employees, OrgSettings, AuditLog), `src/features/roster/*`, `src/features/leave/*`, `src/features/dashboard/*`
- `nginx.conf`(수정: kong 프록시 + 보안헤더/CSP), `Dockerfile`(유지)
- `.github/workflows/rls-guard.yml` 또는 `scripts/check-rls.mjs`(CI RLS 가드)

---

## Phase 0 — 정리 & 인프라 토대

### Task 0.1: 엑셀·데모 코드 제거
**Files:** Delete `src/mockData.ts`, `src/excel/adapt.ts`, `src/components/DataSourceView.tsx`, `src/components/SampleDataNotice.tsx`; Modify `src/App.tsx`(참조 제거).
- [ ] Step 1: 위 4파일 삭제, `App.tsx` 에서 import·사용부 제거(로그인/업로드 게이트 → 임시 빈 셸).
- [ ] Step 2: `npx tsc --noEmit` — 삭제로 인한 참조 오류를 전부 제거될 때까지 수정.
- [ ] Step 3: Commit `refactor: 엑셀 업로드·목데이터 제거`.

### Task 0.2: nginx same-origin 프록시 + 보안헤더
**Files:** Modify `nginx.conf`.
- [ ] Step 1: `nginx.conf` 에 kong 프록시 추가(범위 한정):
```nginx
# supabase kong (내부 네트워크). 관리경로는 노출하지 않는다.
location ~ ^/(auth|rest|storage|realtime)/ {
  proxy_pass http://supabase-kong:8000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
# 보안 헤더
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'" always;
```
- [ ] Step 2: Dokploy frontend 를 supabase compose 네트워크에 연결(`supabase-kong` DNS 해석되게). 검증: 배포 후 `curl -k https://hr.stek.kr/auth/v1/health` → 200.
- [ ] Step 3: Commit `feat: nginx same-origin supabase 프록시 + 보안헤더`.

### Task 0.3: 로컬 supabase 개발환경 & 마이그레이션 도구
**Files:** Create `supabase/config.toml`(supabase CLI init), `scripts/db-apply.mjs`(원격 적용용).
- [ ] Step 1: `supabase` CLI 로 마이그레이션을 로컬에서 검증할 수 있게 init. 원격 적용은 psql 커넥션(전용 마이그레이션 롤)로.
- [ ] Step 2: Commit `chore: supabase 마이그레이션 스캐폴딩`.

---

## Phase 1 — DB 스키마·RLS·RPC (보안 핵심)

> 각 마이그레이션은 로컬 supabase 에 적용 → pgTAP 또는 SQL 어서션 스크립트로 정책 검증 → 커밋.

### Task 1.1: 헬퍼 함수 + 역할 소스
**Files:** Create `supabase/migrations/0001_roles.sql`, Test `supabase/tests/roles.test.sql`.
**Produces:** `public.is_admin()`, `public.is_hr()`, `public.current_role()` (SECURITY DEFINER, search_path 고정).
- [ ] Step 1(test): SQL 어서션 — 익명 세션에서 `is_admin()` = false.
- [ ] Step 2: 마이그레이션 작성:
```sql
-- 역할은 user_roles(사용자 self-write 금지)로 관리
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('시스템관리자','인사담당자','팀장','일반')),
  updated_by uuid, updated_at timestamptz default now()
);
alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
revoke all on public.user_roles from anon, authenticated;

create function public.current_role() returns text language sql
  security definer set search_path=public stable as $$
  select role from public.user_roles where user_id = auth.uid() $$;
create function public.is_admin() returns boolean language sql
  security definer set search_path=public stable as $$
  select public.current_role() = '시스템관리자' $$;
create function public.is_hr() returns boolean language sql
  security definer set search_path=public stable as $$
  select public.current_role() in ('시스템관리자','인사담당자') $$;
revoke execute on function public.current_role(), public.is_admin(), public.is_hr() from public;
grant execute on function public.current_role(), public.is_admin(), public.is_hr() to authenticated;
-- user_roles 는 admin 만 관리
create policy "roles admin all" on public.user_roles for all
  using (public.is_admin()) with check (public.is_admin());
create policy "roles self read" on public.user_roles for select using (user_id = auth.uid());
```
- [ ] Step 3: 검증(어서션 통과) → Commit `feat(db): 역할 소스 user_roles + 헬퍼 함수`.

### Task 1.2: profiles
**Files:** `supabase/migrations/0002_profiles.sql`.
**Produces:** `public.profiles(id, email, name, dept, team, enabled)`.
- [ ] Step 1: 테이블 + RLS. 본인은 비민감 필드만 update(role 없음). admin 전체.
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, dept text, team text, enabled boolean default true,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from anon, authenticated;
grant select (id,email,name,dept,team,enabled) on public.profiles to authenticated;
grant update (name,dept,team) on public.profiles to authenticated;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_hr());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
-- auth.users 생성 시 profiles/user_roles 기본행 트리거
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email) values (new.id, new.email) on conflict do nothing;
  insert into public.user_roles(user_id,role) values (new.id,'일반') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
```
- [ ] Step 2: 검증 → Commit.

### Task 1.3: employees (비민감) + team_managers
**Files:** `supabase/migrations/0003_employees.sql`.
**Produces:** `public.employees(id, 사번, 성명, ...비민감 66항목..., dept_id/team)`, `public.team_managers`.
- [ ] Step 1: 테이블 정의(엑셀 비민감 컬럼 매핑, snake_case 권장하되 화면 매핑 유지). RLS 4종:
```sql
alter table public.employees enable row level security;
alter table public.employees force row level security;
revoke all on public.employees from anon, authenticated;
grant select on public.employees to authenticated; -- 컬럼 GRANT 는 Task 1.6 에서 좁힘
create policy "emp hr all"   on public.employees for all    using (public.is_hr()) with check (public.is_hr());
create policy "emp mgr read" on public.employees for select using (team in (select team from public.team_managers where manager_id = auth.uid()));
create policy "emp self read" on public.employees for select using (user_id = auth.uid());
-- INSERT/UPDATE/DELETE 는 hr 정책으로만 (mgr/self 는 select 만)
```
- [ ] Step 2: 검증(팀장이 타 팀 select 불가, 일반이 타인 select 불가) → Commit.

### Task 1.4: employee_sensitive (분리+암호화)
**Files:** `supabase/migrations/0004_sensitive.sql`.
**Produces:** `public.employee_sensitive`(암호문 bytea), `pgcrypto`.
- [ ] Step 1:
```sql
create extension if not exists pgcrypto;
create table public.employee_sensitive (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  ssn_enc bytea, salary_acct_enc bytea, expense_acct_enc bytea,
  addr_enc bytea, reg_addr_enc bytea, phone_enc bytea, emergency_enc bytea, email_enc bytea
);
alter table public.employee_sensitive enable row level security;
alter table public.employee_sensitive force row level security;
revoke all on public.employee_sensitive from anon, authenticated;
-- 직접 SELECT 정책 없음: 아무도 직접 못 읽음. 접근은 RPC 로만.
```
- [ ] Step 2: 검증(authenticated 가 직접 select → 권한오류) → Commit.

### Task 1.5: 마스킹/원본 RPC
**Files:** `supabase/migrations/0005_sensitive_rpc.sql`.
**Produces:** `get_sensitive_masked(emp uuid) returns jsonb`, `get_ssn_full(emp uuid) returns text`.
- [ ] Step 1: SECURITY DEFINER RPC. 암호화 키는 `current_setting('app.enc_key', true)` 로 주입(DB 밖). 마스킹은 hr 만, 원본은 hr+감사로그+최소.
```sql
create function public.get_sensitive_masked(emp uuid) returns jsonb
  language plpgsql security definer set search_path=public stable as $$
declare k text := current_setting('app.enc_key', true); r record;
begin
  if not public.is_hr() then raise exception 'forbidden'; end if;
  select * into r from public.employee_sensitive where employee_id = emp;
  return jsonb_build_object(
    'ssn', case when r.ssn_enc is null then null else '******-'||right(pgp_sym_decrypt(r.ssn_enc,k),7) end,
    'salary_acct', case when r.salary_acct_enc is null then null else '***'||right(pgp_sym_decrypt(r.salary_acct_enc,k),4) end
    -- 나머지 동일 패턴
  );
end $$;
revoke execute on function public.get_sensitive_masked(uuid) from public;
grant execute on function public.get_sensitive_masked(uuid) to authenticated; -- 내부에서 is_hr 재확인
```
- [ ] Step 2: 원본 RPC 는 hr 만 + `insert into audit_log(...,'read_ssn_full',emp)`.
- [ ] Step 3: 검증(일반 호출 → forbidden, hr 호출 → 마스킹값) → Commit.

### Task 1.6: 컬럼단위 GRANT (준민감)
**Files:** `supabase/migrations/0006_column_grants.sql`.
- [ ] Step 1: employees 의 준민감 컬럼(주소·연락처가 employees 에 있다면)은 일반에게 컬럼 SELECT 미부여. hr 만. (민감 핵심은 이미 분리됨)
- [ ] Step 2: 검증 → Commit.

### Task 1.7: leave_records / org_settings / audit_log
**Files:** `0007_leave.sql`, `0008_settings.sql`, `0009_audit.sql`.
- [ ] Step 1: leave_records(휴직) — 컬럼: employee_id, name, dept, position, reason, start_date, expected_return_date, substitute_assigned, substitute_name, contact, status. RLS: hr CRUD, 팀장 팀 select, 일반 본인.
- [ ] Step 2: org_settings — key/value(jsonb). RLS: authenticated read, admin write. (보안판단에 미사용)
- [ ] Step 3: audit_log — actor,action,target_id,column,ts. append-only(update/delete false), admin read, insert(actor=auth.uid()).
- [ ] Step 4: 각 검증 → Commit.

### Task 1.8: n8n 전용 롤
**Files:** `0010_n8n_role.sql`.
- [ ] Step 1: `n8n_ingest` 롤 — employees/leave insert·update 만, SELECT·employee_sensitive 권한 없음. RLS insert 정책. (service_role 미사용)
- [ ] Step 2: 검증(n8n 롤로 employees select → 실패, insert → 성공, sensitive 접근 → 실패) → Commit.

### Task 1.9: CI RLS 가드
**Files:** Create `scripts/check-rls.mjs`, `.github/workflows/rls-guard.yml`(레포 push 시 실행은 self-hosted 러너 필요 — 없으면 deploy.sh 에 포함).
- [ ] Step 1: public 스키마에 `relrowsecurity=false` 이거나 anon SELECT 허용 테이블 있으면 exit 1.
- [ ] Step 2: deploy.sh 에 이 체크를 배포 전 게이트로 추가. 검증 → Commit.

---

## Phase 2 — 인증

### Task 2.1: supabase 클라이언트·auth 유틸
**Files:** Modify `src/lib/supabase.ts`; Create `src/lib/auth.ts`, Test `src/lib/auth.test.ts`.
**Produces:** `getSession()`, `signIn(email,pw)`, `signOut()`, `useAuth()`(세션+역할), `useRole()`.
- [ ] Step 1(test): mock supabase — signIn 성공 시 세션 반환, 실패 시 에러.
- [ ] Step 2: 구현(supabase.auth.signInWithPassword 등) + 역할은 `user_roles` select(RLS self read).
- [ ] Step 3: 테스트 통과 → Commit.

### Task 2.2: 로그인 페이지 + 라우팅 게이트
**Files:** Create `src/features/auth/LoginPage.tsx`; Modify `src/App.tsx`.
- [ ] Step 1: 로그인 UI(기존 톤). 미인증 → LoginPage, 인증 → 메인. 로그아웃 Navbar.
- [ ] Step 2: 헤드리스로 로그인 흐름 검증(가짜 계정). → Commit.

---

## Phase 3 — 데이터 접근 + 메인 대시보드

### Task 3.1: db.ts (employees/leave 조회)
**Files:** Create `src/lib/db.ts`, `src/lib/rpc.ts`, Test `src/lib/db.test.ts`.
**Produces:** `listEmployees(filter)`, `getEmployee(id)`, `getSensitiveMasked(id)`, `listLeave()`.
- [ ] Step 1(test): mock — listEmployees 가 supabase.from('employees').select 호출.
- [ ] Step 2: 구현. derive.ts 규칙을 조회 결과에 적용(제외·TBS·현장직·D-Day). → Commit.

### Task 3.2: 대시보드 DB 연동
**Files:** Modify `src/features/dashboard/*`(기존 DashboardOverview 재사용), 데이터 소스만 db.ts 로.
- [ ] Step 1: mockData 대신 db.ts 결과로 KPI·차트. 기준일 재계산 유지.
- [ ] Step 2: 검증 → Commit.

---

## Phase 4 — 직원 명부/상세 (마스킹)

### Task 4.1: 명부 목록
**Files:** Create `src/features/roster/RosterPage.tsx`(기존 명부 UI 재사용).
- [ ] Step 1: db.listEmployees + 필터. 민감컬럼은 표에 미표시.
- [ ] Step 2: 검증 → Commit.

### Task 4.2: 상세 + 마스킹 RPC + 인라인 수정(hr)
**Files:** Create `src/features/roster/EmployeeDrawer.tsx`.
- [ ] Step 1: 상세 조회. 민감값은 `getSensitiveMasked` RPC(hr 만 값, 그 외 '권한없음'). 수정은 hr 만.
- [ ] Step 2: 검증(일반 계정에서 민감값 안 보임) → Commit.

---

## Phase 5 — 휴직 관리

### Task 5.1: 휴직 목록/CRUD
**Files:** Create `src/features/leave/LeavePage.tsx`(기존 LeaveManagement 형식 재사용).
- [ ] Step 1: db.listLeave + 상태변경. hr CRUD, 팀장 팀조회.
- [ ] Step 2: 검증 → Commit.

---

## Phase 6 — 관리자

### Task 6.1: 사용자·역할 관리
**Files:** Create `src/features/admin/UsersPage.tsx`.
- [ ] Step 1: 계정 목록(profiles+user_roles), 생성(supabase admin invite/createUser via RPC or Auth admin), 역할 부여(admin RLS), 비활성.
- [ ] Step 2: 검증(비관리자 접근 차단) → Commit.

### Task 6.2: 직원 CRUD + 일괄 임포트
**Files:** Create `src/features/admin/EmployeesAdmin.tsx`, `src/features/admin/importExcel.ts`(기존 parse.ts 재사용).
- [ ] Step 1: 개별 CRUD(hr). 일괄 임포트: 관리자만, 파싱→employees upsert(민감값은 employee_sensitive 암호화 RPC 경유).
- [ ] Step 2: 검증 → Commit.

### Task 6.3: 조직·기준·기능토글 설정
**Files:** Create `src/features/admin/OrgSettings.tsx`.
- [ ] Step 1: org_settings CRUD(admin). 입력 on/off 토글이 화면 동작에 반영(보안판단 아님).
- [ ] Step 2: 검증 → Commit.

### Task 6.4: 감사로그 뷰
**Files:** Create `src/features/admin/AuditLog.tsx`.
- [ ] Step 1: audit_log 조회(admin). 민감원본 없음 확인.
- [ ] Step 2: 검증 → Commit.

---

## Phase 7 — 시드 & 배포

### Task 7.1: 데모 시드 스크립트
**Files:** Create `supabase/seed/seed.mjs`.
- [ ] Step 1: 엑셀 10명 → employees(비민감) + employee_sensitive(가짜 민감값 암호화) + leave_records 데모 3~5행 + 관리자 1계정. **주민번호·계좌는 000000... 가짜.**
- [ ] Step 2: 로컬/원격 적용 검증 → Commit. (검증 후 `인사자료/*.xlsx` 레포에서 제거)

### Task 7.2: Dokploy env & 배포
**Files:** Modify Dokploy frontend env(`VITE_SUPABASE_URL=https://hr.stek.kr`), 배포.
- [ ] Step 1: env 갱신, frontend 를 supabase 네트워크 연결, api.hr.stek.kr 유지(또는 same-origin 만).
- [ ] Step 2: 배포 후 헤드리스 로그인→명부→민감마스킹 검증. → Commit.

### Task 7.3: 보안 마감 점검
- [ ] Step 1: CI RLS 가드 통과, Studio·5432 외부차단 확인, CSP 헤더 확인, 시드 가짜값 확인.
- [ ] Step 2: 보안 에이전트 P0/P1 체크리스트 대조 → 문서화.

---

## Self-Review 메모
- 스펙 8절 P0(1~6)·P1(7~14)·P2 → Phase 1(RLS/RPC/롤/CI가드)·0.2(CSP/프록시)·6.3(설정)·6.4/1.7(audit) 에 매핑됨.
- 분석 화면(인건비·교육·평가·인력정밀분석)은 v1 범위 밖(스펙 9절) — 대시보드·명부·휴직만 DB화.
- 미해결 확인 필요: 사내 CA 인증서 전환(P0-5)·api.hr.stek.kr DNS·frontend↔supabase 네트워크 연결은 인프라 작업으로 Task 0.2/7.2 에 포함하되 DNS 는 사용자 조치.
