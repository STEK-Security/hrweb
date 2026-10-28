# P2 hr.stek.kr 근태관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hr.stek.kr 에 '근태관리' 메뉴(현황·근무표·정정·승인·확정·마감·규칙·직원 설정)를 만들고, Supabase Edge Function `attendance` 로 time.stek.win `/api/admin/*` 를 중계한다.

**Architecture:** 브라우저 → `supabase.functions.invoke('attendance', {body:{method,path,query,body}})` → Edge Function(JWT + `is_hr()` 확인, 경로 화이트리스트, `ADMIN_TOKEN`·`X-Actor` 부착) → `https://time.stek.win/api/admin/...`. 근태 데이터 사본은 Supabase 에 두지 않는다. 예외: 근무조 28일 패턴(Supabase 테이블).

**Tech Stack:** React 19 + Vite + Tailwind 4 + lucide-react (hrweb), Supabase(자체 호스팅) Edge Functions(Deno edge-runtime), Postgres RLS.

**Spec:** `/home/stek/stek/hr/hr-Attendance/docs/superpowers/specs/2026-10-27-hr-attendance-design.md` 6절 + **11절(우선, 특히 11.4·11.7)**. UI 시안: https://claude.ai/artifact/8cMHwBuoPvV6mweBH32VNk (11.7 에 글로 정리됨).
Worker API 정본: `/home/stek/stek/hr/hr-Attendance/src/worker/routes/admin.ts` (+ `docs/n8n.md`, README). 요청/응답 모양은 여기서 읽는다.

## Global Constraints

- 권한: hr.stek.kr 사용자 전원(`is_hr()`). 관리자 전용 아님.
- 경고(flags)는 hr.stek.kr 에서만 보인다(이 메뉴는 보여도 됨).
- 시크릿 `ATTENDANCE_ADMIN_TOKEN` 은 Edge Function env 에만. 브라우저 번들·레포에 절대 넣지 않는다.
- 모든 변경 작업은 `log_event` 감사(action 화이트리스트 추가) — Worker 쪽 audit 은 X-Actor(사용자 이메일)로 자동.
- hrweb 스타일 그대로: 흰 카드 `bg-white rounded-xl border border-slate-200 shadow-xs`, 주 버튼 `bg-blue-600`, 글자 slate, 아이콘 lucide-react. 새 의존성 추가 금지(엑셀 쓰기도 직접 구현).
- Worker 무료 플랜: 한 번에 큰 요청 금지 — schedules PUT 500행, export 20명 페이지, 마감은 `/jobs/step` 반복.
- 검증: `bun run lint`(tsc), `bun run test:unit`, `bun run build` 통과. 새 순수 로직은 `test/unit/*.ts`(tsx 스크립트, 기존 방식)로 테스트하고 `test:unit` 스크립트에 추가.
- 실데이터 xlsx 열기·커밋 금지. 배포는 하지 않는다(컨트롤러가 함).

## Review Focus

1. Edge Function 이 화이트리스트 밖 경로(`/api/ingest/*`, `../`, 절대 URL)를 절대 중계하지 않는다.
2. is_hr 가 아닌 로그인 사용자 → 403, 토큰 없음 → 401, Worker 오류 상태·본문은 그대로 전달.
3. 패턴 적용이 마감 달·오늘 이전·직접 수정한 칸(note 가 `pattern:` 로 시작하지 않는 기존 행)을 덮어쓰지 않는다.
4. 마감 진행: close 202 → `/jobs/step` 반복 → 완료/실패 표시, 중간에 탭을 떠나도 다시 들어오면 진행 중 작업을 이어 표시.
5. 엑셀: 18열 순서, 한글 깨짐 없음, 20명 페이지를 모두 합침.

---

### Task 1: Edge Function `attendance` + 클라이언트 + 감사 action

**Files:** Create `supabase/functions/attendance/index.ts`, `supabase/functions/attendance/routes.ts`(순수: 화이트리스트 판정), `src/lib/attendance.ts`, `supabase/migrations/0032_attendance_audit.sql`(번호는 실제 마지막 다음), `test/unit/attendanceRoutes.ts`. Modify `package.json` test:unit. 참고: `supabase/functions/send-mail/index.ts`(인증·CORS 패턴), 최신 `log_event` 정의 마이그레이션(액션 목록 전체를 이어받아 추가 — 기존 회귀 주의 주석 참고).

- `routes.ts`: `allowed(method, path): boolean` — path 는 `/api/admin/` 로 시작, `..`·`//`·`?`·`#` 없음, 아래 목록의 (method, 정규식)만 허용: Worker admin.ts 에 있는 모든 엔드포인트(GET days/month/matrix/corrections/shift-types/holidays/rules/schedules/employees/confirmations/export/unmatched/audit/months/months/:ym/precheck/jobs/jobs/:id/months/:ym/snapshot; POST corrections/:id, days/:sabun/:date/edit, rules, recompute, accounts/:sabun/reset, months/:ym/close, months/:ym/reopen, jobs/step; PUT shift-types/holidays/schedules; PATCH employees/:sabun).
- `index.ts`: OPTIONS CORS; Authorization 의 JWT 로 `auth.getUser` → 없으면 401; `rpc('is_hr')` false → 403; body `{method, path, query?: Record<string,string>, body?: unknown}` 검증 → `allowed` 아니면 400; `fetch(ATTENDANCE_API_URL + path + ?query, {method, headers: {Authorization: 'Bearer ' + ATTENDANCE_ADMIN_TOKEN, 'X-Actor': user.email, 'Content-Type': 'application/json'}, body})`, 20초 타임아웃 → 상태코드·JSON 본문 그대로 반환(타임아웃 504). env: `ATTENDANCE_API_URL`(기본 `https://time.stek.win`), `ATTENDANCE_ADMIN_TOKEN`.
- `src/lib/attendance.ts`: `att<T>(method, path, opts?) : Promise<T>` — invoke 래퍼, 오류 시 Worker 의 `{error, message}` 를 담은 `AttendanceError` throw. 타입은 필요한 만큼만.
- 마이그레이션: log_event 화이트리스트에 `attendance.view, attendance.schedule, attendance.rules, attendance.correction, attendance.employee, attendance.close, attendance.reopen, attendance.export, attendance.pattern` 추가.
- Test: `allowed` 의 허용/거부 표(Review Focus 1 포함).
- [ ] 테스트 먼저 → 구현 → lint/test:unit/build → 커밋 `feat(attendance): Edge Function 중계·클라이언트·감사 action`.

### Task 2: 메뉴 골격 + 현황 탭

**Files:** Modify `src/types.ts`(ActiveMenu '근태관리'), `src/components/Navbar.tsx`(아이콘 `Clock`), `src/App.tsx`. Create `src/features/attendance/AttendancePage.tsx`(하위 탭 6개, 월 선택 상태 공유), `StatusTab.tsx`.

- 하위 탭 순서·이름은 스펙 11.7. 탭은 URL 해시 없이 상태로(기존 메뉴 방식과 같게). 정정·승인 탭 라벨에 대기 건수 배지.
- 현황: 월 이동 + 상태 칩(`GET /months`), 요약 카드 4개(대상 수 = employees attendance_target, 확정 수 = confirmations, 대기 정정 = corrections status=pending, 경고 수 = matrix 의 flags 합), 직원×일 매트릭스(`GET /matrix?ym=`; 칸: 주/야/휴/연/! 와 경고 점선, 이름 열 sticky, 가로 스크롤, 근무조·부서 필터), 오른쪽 경고 목록(flag 종류별 개수, 누르면 해당 직원·날짜 목록). 칸을 누르면 일별 상세 모달(`GET /month?ym&sabun` 의 그 날: 출퇴근·분·flags, "HR 수정" 버튼 → `POST /days/:sabun/:date/edit`).
- flag 한국어 이름표는 `src/features/attendance/labels.ts` 하나에.
- [ ] 구현 → lint/build → 커밋 `feat(attendance): 근태관리 메뉴·현황`.

### Task 3: 근무표 탭 (근무조·28일 패턴)

**Files:** Create `supabase/migrations/0033_attendance_patterns.sql`, `src/features/attendance/ScheduleTab.tsx`, `src/features/attendance/pattern.ts`(순수), `test/unit/attendancePattern.ts`.

- 테이블 `attendance_shift_patterns(group_name text primary key, anchor_date date not null, pattern text[] not null check(array_length(pattern,1)=28), updated_at, updated_by)` RLS `is_hr()` 읽기·쓰기. 시드: A조(DAY×5,REST×2,DAY×5,REST×2,NIGHT×5,REST×2,NIGHT×5,REST×2), B조(반대), 품질A조=A조, 품질B조=B조, anchor 2026-11-02(월).
- 근무조 목록: 패턴 테이블 + 직원 수(`GET /employees` 의 shift_group 집계). "+ 근무조 추가" = 새 패턴 행.
- `pattern.ts`: `buildCells(pattern, anchor, from, to, sabuns, existing, opts:{holidays:Set<string>, holidayAsRest:boolean, today:string, closedYms:Set<string>}) → {sabun, work_date, shift_code, note}[]` — 날짜 d 의 코드 = pattern[((d−anchor) mod 28 + 28) mod 28]; 공휴일·holidayAsRest 면 REST; d < today 또는 마감 달 제외; existing 행이 있고 note 가 `pattern:` 로 시작하지 않으면 제외(덮어쓰지 않음); note = `pattern:<조>`. Worker `PUT /schedules` 의 실제 body 모양(admin.ts)을 따른다.
- 적용: 미리보기(건수·제외 사유별 건수) → 500행씩 PUT, 진행률. 근무조 미지정 직원 수 경고.
- Test: 모듈러 음수 날짜, 공휴일, 오늘 이전, 마감 달, 직접 수정 칸 보존(Review Focus 3).
- [ ] 테스트 먼저 → 구현 → 커밋 `feat(attendance): 근무조 28일 패턴 근무표`.

### Task 4: 정정·승인 탭 + 직원 설정 탭

**Files:** Create `CorrectionsTab.tsx`, `EmployeesTab.tsx`.

- 정정·승인: `GET /corrections`(상태 필터: 대기/전체, stuck=1 "팀장 미처리"), 표(신청자·날짜·요청 시각·사유·승인자·상태·시각), 대기 건은 인사팀 승인/반려(`POST /corrections/:id`, 반려 사유 입력). 팀장 본인 신청은 인사팀 승인함으로 상단에.
- 직원 설정: `GET /employees` 표 + 행 편집(근무조 select(패턴 테이블 이름 + 없음), 근태 대상, 야간근로 동의, 승인자 지정(사번 검색)) → `PATCH /employees/:sabun`; 비밀번호 초기화(`POST /accounts/:sabun/reset`, 확인 대화상자).
- [ ] 구현 → 커밋 `feat(attendance): 정정·승인·직원 설정`.

### Task 5: 확정·마감 탭 + 규칙 탭 + 엑셀

**Files:** Create `CloseTab.tsx`, `RulesTab.tsx`, `src/lib/xlsxWrite.ts`(의존성 없는 최소 xlsx 쓰기: 무압축 zip + crc32, 시트 1개, 문자열·숫자 셀), `test/unit/xlsxWrite.ts`.

- 확정·마감: 4단계 카드(precheck 결과), "지금 마감하기" → `POST /months/:ym/close`(202, job) → `POST /jobs/step` 반복(응답의 진행률 표시, 완료/실패) — 탭 진입 시 `GET /jobs` 로 진행 중 작업을 찾아 이어감; 마감 취소(확인 대화상자). 직원 확정 표(`GET /confirmations`, 미확정만 필터). 급여 엑셀: `GET /export?ym&cursor` 를 nextCursor 가 null 일 때까지 반복해 합친 뒤 `xlsxWrite` 로 `근태_YYYY-MM.xlsx` 다운로드(열 18개 순서 그대로, 마감 전이면 파일명에 `_미마감`).
- 규칙: 근무형태 표 편집(`GET/PUT /shift-types`), 공휴일 목록(`GET/PUT /holidays`), 계산 규칙 폼(overtimeMode 실측/기안, roundUnitMin 1·5·10·15·30·60, nightIncludesBreaks, punchWindowBeforeMin/AfterMin, closeDay; 적용 시작 월) → `POST /rules`; roundUnitMin > 1 이면 법률 경고 문구(스펙 11.6). 시안의 "이 규칙으로 계산하면" 미리 계산은 이번에 하지 않는다(엔진이 다른 레포).
- Test: xlsxWrite 산출물이 올바른 zip 시그니처·파일 목록·한글 셀을 담는지(파일을 parse.ts 로 다시 읽어 값 비교).
- [ ] 테스트 먼저 → 구현 → lint/test:unit/build → 커밋 `feat(attendance): 확정·마감·규칙·급여 엑셀`.
