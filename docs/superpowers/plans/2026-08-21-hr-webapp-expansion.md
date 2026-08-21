# STEK HR 웹앱 확장 Implementation Plan (v2)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development 로 태스크별 실행.

**Goal:** hr-app.html 전 기능 + 직접입력 CRUD + 웹 감사로그(IP) + 2역할 + 세션수정 + 신규기능을 supabase DB 기반으로 구현.

**Spec:** docs/superpowers/specs/2026-08-19-hr-webapp-redesign-design.md (기반). 이 문서는 확장분.

## 확정 결정 (사용자)
- 역할 2개: **사용자(인사팀=전 기능)** / **관리자(+로그·계정·설정)**. is_hr=둘다 true, is_admin=관리자만. 팀장/일반 role·정책 제거(soft: 값 마이그레이션+정책 정리).
- IP 기록: **서버측**(nginx access log + 로그인/행위 로그에 Edge Function/트리거가 X-Forwarded-For 주입). 클라 insert 로는 IP 신뢰불가.
- 직원 삭제: **soft delete**(`deleted_at`/퇴직처리, 행 보존).
- 인건비: **보류**(원천데이터 없음). 교육·평가: **신규 테이블+직접입력**.

## Global Constraints (기반 스펙 계승)
- 민감값 평문 금지·set_sensitive/reveal RPC 만. 전 테이블 RLS+force. same-origin 프록시. main push=배포. 시드 가짜 민감값.
- 감사로그 값 원본 기록 금지(컬럼명/사실만). append-only.

---

## Phase 8 — 기반: 세션 + 2역할
### T8.1 세션 유지 수정 (프론트)
- `src/lib/supabase.ts`: `auth.persistSession:false` → **true**, `autoRefreshToken:true`, `storage: localStorage`. (새로고침 시 세션 유지)
- `src/lib/auth.ts`: 권한조회 실패 시 조용히 '일반' 폴백하지 말고 로딩완료+명확 상태. onAuthStateChange 로 세션복원.
- 검증: 로그인 후 새로고침해도 세션 유지(배포 E2E).

### T8.2 2역할 마이그레이션 (DB)
- `supabase/migrations/0012_two_roles.sql`: user_roles.role check 를 `('사용자','관리자')` 로. 기존값 매핑(시스템관리자→관리자, 그 외→사용자). `is_hr()`= role in ('사용자','관리자')(=인증된 전원), `is_admin()`= '관리자'. 팀장/일반 전용 정책(emp mgr/self read, leave mgr/self read) DROP. team_managers 는 미사용(보존 or drop — drop 권장).
- **주의**: 배포된 DB 에 적용 SQL 을 사용자가 Studio 로 실행. hotfix 형태로 제공.
- 검증: 사용자 role 로 전 직원 조회 가능, 관리자만 audit/settings/user_roles write.

---

## Phase 9 — 웹 행위 감사로그 + IP + 관리자 뷰어
### T9.1 감사 이벤트 확장 (DB)
- `0013_audit_events.sql`: audit_log 에 `ip inet`, `user_agent text`, `meta jsonb`, `actor_email text`(로그인실패용) 추가. action 종류 확대(login_success/login_fail/logout/view_screen/view_employee/create_employee/update_employee/delete_employee/create_leave/update_leave/export/reveal/read_ssn_full/role_change).
- IP 주입: 로그 insert 를 **Edge Function `log-event`** 로 감싸 요청헤더 IP/UA 를 서버에서 채움(클라 insert 정책은 유지하되 IP/UA 는 서버만 신뢰). 또는 PostgREST pre-request 훅으로 `request.headers` 사용.
### T9.2 프론트 로깅 훅
- `src/lib/audit.ts`: `logEvent(action, {targetId,targetTable,meta})` → Edge Function 호출. 로그인/로그아웃/화면전환/CRUD/보이기/내보내기에서 호출.
### T9.3 관리자 감사로그 뷰어 화면
- `src/features/admin/AuditLogPage.tsx`: 기간·actor·action·대상 필터, profiles join 이름, reveal/ssn 열람 강조. **관리자만**(is_admin RLS). append-only.

---

## Phase 10 — 직접입력 CRUD (엑셀 대체)
### T10.1 직원 입력/수정 폼
- `src/features/roster/EmployeeForm.tsx`: 69컬럼 섹션별(기본/조직/입퇴사/학력/병역/국적체류/기준일). 자동계산(나이·근속) readonly. 필수=성명·사번·입사일. 부분저장 허용.
- 민감값: set_sensitive RPC(변경 키만 payload). 형식검증(주민번호·전화·이메일) 프론트+가능시 서버.
- soft delete: `deleted_at` 컬럼(0014 마이그레이션) + 목록 기본 필터. 
- 감사: create/update/delete_employee 로그.
### T10.2 휴직 입력/CRUD
- `src/features/leave/LeaveForm.tsx`: 신규 휴직 등록·상태전환·대체인력. 감사 로그.

---

## Phase 11 — 기능 화면 (hr-app 파리티 + 신규)
### T11.1 인력현황 4서브탭 (상세분석/입퇴사Peak/인력구성비/휴직복직)
### T11.2 구성·다양성 (성별·연령·국적·학력 분포)
### T11.3 HR캘린더 (DB 영속): `hr_events`,`hr_checklists` 신규 테이블 + CRUD
### T11.4 조직도 (전체소속명 트리) [신규 P0]
### T11.5 인사발령이력 [신규 P0]: `employee_transfers` 이력 테이블 + 등록
### T11.6 데이터품질 리포트 [신규 P1]: 사번중복·필수값누락·형식오류 스캔
### T11.7 전역검색 [신규 P0]
### T11.8 증명서 발급(재직/경력) [신규 P0]: employees 데이터로 문서 생성
### T11.9 교육관리 [신규]: `training_courses`,`training_records` + 입력
### T11.10 평가관리 [신규]: `evaluations` + 입력
- 죽은 탭 5개 라우팅 수리, 메뉴명 충돌(인력현황) 정리.

---

## Phase 12 — 관리자
### T12.1 계정·역할 관리 (사용자 생성/비활성/역할부여) [관리자]
### T12.2 조직·기준·기능토글 설정 [관리자]

---

## Phase 13 — 최종 리뷰
- **코드리뷰**(agent-skills:code-reviewer) + **보안리뷰**(security-auditor): 전 변경 대상. RLS·감사로그·IP·CRUD·세션.

## 미결(진행중 확정)
- 그룹웨어ID 컬럼 추가 여부: 폼에서 제외(레거시), 필요시 후속.
- 인력현황 HC-4 와 휴직관리 중복: **휴직관리로 단일화**(HC-4 는 링크만).
