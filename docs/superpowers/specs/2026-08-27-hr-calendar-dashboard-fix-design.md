# HR캘린더·대시보드 오류 수정 및 분류기준 재정의 설계

- 작성일: 2026-08-27
- 상태: 구현 완료 (승인 2026-08-27 / 구현 2026-08-27)
- 대상 코드: `/home/stek/stek/hr` (react + vite + supabase)

## 1. 배경

운영 검증 중 다음이 접수됐다.

**오류**
1. HR캘린더에서 직접 등록한 일정이 대시보드에 반영되지 않는다(자동생성 일정 제외).
2. HR캘린더에 입·퇴사일이 일부만 나온다. 같은 건이 대시보드에는 나온다.
3. 대시보드 기준일자를 변경해도 비율별 분포·인원분포 현황·인원집계 현황표가 바뀌지 않는다.

**분류기준 변경**
4. 그룹웨어 직급 체계 개편 완료. 사무직은 기존대로, 현장직은 `사원(기능)`/`리더`/`책임`. **이 3개 직급인 사람만 현장직으로 카운트하고 나머지는 전부 사무직**으로 카운트한다.
5. 부서별 인원 분포의 집계 단위를 본부 → **그룹웨어 기준 "부서"(= `소속` 컬럼 = 팀명)** 로 변경한다.

**기타**
6. 생일 자동일정 생성 기능 삭제.
7. 자동생성 일정의 자동 삭제 정책 확인 요청(직원 삭제 시 / 퇴사 후 잔여 일정).

## 2. 근본 원인 분석

### 2.1 오류 1 — 수동 등록 일정이 대시보드에 없음

`CalendarPage`는 수동일정을 `hr_events` 테이블에 저장한다(`createHrEvent`).
`DashboardPage`는 `listEmployees()`/`listLeave()`만 호출하고 **`listHrEvents()`를 호출하지 않는다**.
대시보드가 넘기는 `calendarEvents`는 `buildCalendarEvents(employees)` 한 줄로, employees 파생 이벤트만 담긴다.

→ 수동일정이 대시보드로 흘러들 경로 자체가 없다. 데이터 문제가 아니라 배선 누락.

- `src/features/dashboard/DashboardPage.tsx` — `calendarEvents = buildCalendarEvents(employees)`
- `src/lib/db.ts:319` — `listHrEvents()` 는 이미 존재(캘린더만 사용)

### 2.2 오류 2 — 캘린더에 입·퇴사일 일부만

자동일정 생성이 **두 파일에 서로 다르게 2중 구현**되어 있다.

| | `CalendarPage.buildAutoEvents()` | `DashboardPage.buildCalendarEvents()` |
|---|---|---|
| 대상자 | `if (!e._activeNow) continue` → **퇴직자 전원 제외** | 전원 |
| 기간 | 표시 중인 1개월(`date.startsWith(monthPrefix)`) | 전년~차년 3년 |
| 재직기간 가드 | 없음 | `employedOn()` 으로 수습평가·계약종료 필터 |
| 계약종료 일정 | 없음 | 있음 |
| 생일 | 표시월 1건 | 3년치 |
| 라벨 | `{이름} 입사일` | `{팀} {이름} 입사` |

퇴직자(퇴직일 ≤ 오늘)는 캘린더에서 입·퇴사일 자체가 생성되지 않고, 대시보드에서는 생성된다. 접수된 증상과 정확히 일치한다.

부수적으로, 캘린더에는 재직기간 가드가 없어 **퇴사예정자에게 퇴사일 이후의 최종수습평가 일정이 표시**된다(7번 문의 사항이 캘린더에서만 미충족).

### 2.3 오류 3 — 기준일자가 일부 지표에만 반영

`asOfDate` state가 자식 컴포넌트 `DashboardOverview` 내부에만 있다(`src/components/DashboardOverview.tsx:81`).

- 기준일에 반응하는 것: 총원/입사자/퇴사자/전월비/연누적 — `employeeRecords`(hireDate·quitDate 배열) prop으로 컴포넌트 내부에서 재계산한다(`headcountAsOf()`).
- 반응하지 않는 것: `genderRatioData`, `nationalityRatioData`, `jobTypeRatioData`, `ageRatioData`, `positionDistributionData`, `departmentDistributionData`, `matrixRows` — **부모 `DashboardPage`가 '오늘' 기준으로 계산해 넘긴 완성 props**를 그대로 렌더한다.

부모는 `asOfDate`의 존재를 모른다. 자식이 아무리 날짜를 바꿔도 부모가 다시 계산할 트리거가 없다.

### 2.4 분류기준 — 현재 구현

- 현장직 판정: `src/excel/derive.ts` `officeType(team, div)` = `/생산|품질|물류/` 정규식이 **소속명**에 걸리는지 본다. 직급과 무관.
- 부서 분포: `DashboardPage.buildDepartmentDistribution()` 이 `e._div`(전체소속명 2번째 토큰 = 본부)로 그룹핑한다.
- 영향 범위: `_office`는 `buildJobTypeRatio()`(대시보드·인력현황 공용), `HeadcountPage.buildFieldWorkDrilldown()`(현장직→생산직/물류직 하위분류)에서 쓰인다.

### 2.5 자동일정 자동삭제 (7번 문의 답변)

자동일정은 **DB에 저장하지 않는다**. `hr_events`에는 수동일정만 들어가고, 입·퇴사일·수습평가일은 employees에서 매 렌더 파생한다(`supabase/migrations/0017_calendar.sql` 주석에 설계 의도 명시: "원본 데이터가 employees 라 이중 관리를 피한다").

따라서:

| 문의 | 현재 동작 | 조치 |
|---|---|---|
| 입사취소로 구성원 정보 삭제 시 일정도 삭제되나 | **자동 삭제됨.** `listEmployees()`가 `deleted_at is null`만 읽으므로 soft delete 즉시 파생 일정이 사라진다 | 변경 없음 |
| 퇴사해서 불필요해진 최종수습평가 일정이 자동 삭제되나 | **대시보드는 이미 제외**(`employedOn()` 가드), **캘린더는 제외 안 됨**(가드 없음) | 공통 함수로 통일하면 해소 |

## 3. 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 현장직 직급 값 | 기존 `직급` 컬럼에 `사원(기능)`/`리더`/`책임` 문자열이 그대로 들어온다. 이 3개만 현장직, 나머지 전부 사무직 |
| 부서 레벨 | `소속`(= 전체소속명 마지막 토큰 = 팀명) 을 부서로 집계 |
| 퇴직자 자동일정 | 입·퇴사일은 퇴직자 포함 전원 생성. 기간성 일정(수습평가·계약종료)은 `입사일 ≤ 일정일 ≤ 퇴사일`일 때만 생성 |
| 기준일 적용 범위 | 대시보드 전체를 기준일 시점 스냅샷으로. 비율분포·인원분포·집계표·휴직자 수, 그리고 나이·근속연수까지 기준일 기준 재계산 |
| 채택 설계 | A안 (파생 로직 단일화 + 기준일 상위 이관) |

## 4. 설계

### 4.1 구조 변경 개요

```
[변경 전]
CalendarPage ──buildAutoEvents()──┐              (서로 다른 2중 구현)
                                  ├── HRCalendarView
DashboardPage ─buildCalendarEvents()┘             (hr_events 미조회)
               └─ '오늘' 고정 집계 props ─→ DashboardOverview (asOfDate state 내부 보유)

[변경 후]
                     src/lib/autoEvents.ts  ← 단일 소스
                            ▲        ▲
CalendarPage ───────────────┘        └──────────── DashboardPage
   + hr_events                                       + hr_events (병합)
                                                     + asOfDate state (소유)
                                                     + deriveAllAsOf(rows, asOf)
                                                            │
                                                            ▼
                                            DashboardOverview (controlled)
```

### 4.2 신규 모듈 — `src/lib/autoEvents.ts`

employees 기반 자동일정 생성의 유일한 소스. 순수함수, DB 접근 없음.

```ts
export interface AutoEventRange { from: string; to: string }  // ISO yyyy-mm-dd, 양끝 포함

export function buildAutoEvents(
  employees: Employee[],
  range: AutoEventRange
): CalendarEventItem[]
```

생성 종류와 규칙:

| 종류 | category | 대상 | 조건 |
|---|---|---|---|
| 입사일 | `입사자` | 전원(퇴직자 포함) | `입사일`이 range 내 |
| 퇴사일 | `퇴사자` | 전원 | `퇴직일`이 range 내. 미래면 제목에 `(예정)` |
| 1차 수습평가 | `1차 수습평가` | 전원 | 입사일+30일이 range 내 **AND** 재직기간 내 |
| 최종 수습평가 | `최종 수습평가` | 전원 | 입사일+55일이 range 내 **AND** 재직기간 내 |
| 계약종료 | `인사일반` | 전원 | `계약종료일`이 range 내 **AND** 재직기간 내 |
| ~~생일~~ | — | — | **삭제** (요청 6) |

- 재직기간 내 판정: `employedOn(iso) = (!입사일 || iso >= 입사일) && (!퇴직일 || iso <= 퇴직일)`
- `source: '인사DB연동'`, id는 `{종류}-{employees.id}` 로 안정적 생성(재렌더 시 동일)
- 제외 대상: `deriveAll()`이 이미 테스트/GPRO 행을 걸러낸 결과를 받으므로 추가 필터 불필요
- 수습평가 일수(+30/+55)는 `org_settings.probation_days` 가 있으나 현재 `derive.ts`가 상수로 계산한다. 이번 범위에서는 **현행 유지**(별도 과제)

호출 측:
- `CalendarPage`: `range = 표시월 1일 ~ 말일` (기존 표시월 필터 동작 유지)
- `DashboardPage`: `range = 기준일 연도-1년 1/1 ~ 기준일 연도+1년 12/31` (기존 3년 범위 유지)

### 4.3 기준일 스냅샷 — `deriveAllAsOf()`

`src/excel/derive.ts`에 추가한다.

```ts
/** 기준일(asOf)을 적용해 파생필드를 다시 계산한다. 전역 TODAY 는 호출 전 값으로 복원된다. */
export function deriveAllAsOf(rows: RawRow[], asOf: string): Employee[]
```

- 구현: `setToday(asOf)` → `deriveAll(rows)` → `setToday(이전값)` 복원. 동기 실행이므로 전역 `TODAY` 오염 없음.
- 입력 `rows`로 **이미 파생된 `Employee[]`를 그대로 넘길 수 있다**: `type Employee = RawRow & Derived` 라서 원본 한글 컬럼을 전부 보유한다. 추가 DB 조회 불필요.
- 이로써 `_activeNow`·`_age`·`_ageBand`·`_tenure`·`_tenureBand`·`_dday*` 가 모두 기준일 기준으로 재계산된다.

`DashboardPage`:

```ts
const [asOfDate, setAsOfDate] = useState(localISO(new Date()));
const snapshot = useMemo(() => deriveAllAsOf(employees, asOfDate), [employees, asOfDate]);
const active = snapshot.filter((e) => e._activeNow);
// 기존 build* 함수들은 시그니처 변경 없이 snapshot/active 를 받는다
```

휴직자 수도 기준일 기준으로 판정한다:

```ts
const onLeaveAsOf = (l: LeaveRecord, iso: string) =>
  !!l.start_date && l.start_date <= iso &&
  (l.status === '휴직중' ? true : !l.expected_return_date || l.expected_return_date > iso);
```

- 기존 `status === '휴직중'` 단순 카운트는 '오늘' 전용이라 과거 기준일에서 틀린 값을 준다.

### 4.4 `DashboardOverview` controlled 전환

- 제거: `const [asOfDate, setAsOfDate] = useState(todayDateStr)`
- 추가 props: `asOfDate: string`, `onChangeAsOfDate: (iso: string) => void`
- 내부 팝오버 캘린더(`calendarYear`/`calendarMonth`/`selectedDay`)와 `handleSelectDate`는 유지하되, `setAsOfDate(...)` → `onChangeAsOfDate(...)` 로 교체
- `employeeRecords` prop 기반 재계산 로직(`headcountAsOf` 등)은 **그대로 둔다**. 부모가 스냅샷으로 계산한 값과 이중 계산이 되지만 결과가 동일하고(같은 hireDate/quitDate 규칙), 원본 UI 파일 수정 범위를 최소화하는 편이 안전하다. — ponytail: 중복 계산 1곳, 값 불일치 발생 시 부모 단일화로 승격

### 4.5 분류기준 변경

**현장직/사무직** — `src/excel/derive.ts`

```ts
/** 그룹웨어 개편(2026-08) 현장직 직급. 이 직급인 사람만 현장직, 나머지는 전부 사무직. */
export const FIELD_GRADES = ['사원(기능)', '리더', '책임'];

const officeType = (grade: string): '사무직' | '현장직' =>
  FIELD_GRADES.includes(grade.trim()) ? '현장직' : '사무직';
```

- 호출부 변경: `r._office = officeType(r._grade)` (기존 `officeType(r._team, r._div)`)
- `PRODUCTION_RE`(`/생산|품질|물류/`)는 **삭제하지 않는다**. 현장직 판정 용도만 잃고, `HeadcountPage.buildFieldWorkDrilldown()`의 생산직/물류직 **하위 분류**에는 계속 팀명 기준으로 쓴다(그룹웨어 직급에는 생산/물류 구분 정보가 없다).
- 주의: 직급 `리더`와 `derive.ts`의 `isLeader()`(직책 기반 팀 리더 판정)는 별개 개념이다. `isLeader()`는 `LEADER_RE`로 **직책**을 보므로 영향 없다.

**직급 목록의 설정화** — `supabase/migrations/0027_settings_field_grades.sql`

```sql
insert into public.org_settings (key, value)
values ('field_grades', '["사원(기능)", "리더", "책임"]'::jsonb)
on conflict (key) do nothing;
```

- `OrgSettingsPage`는 이미 임의 JSON 값을 편집할 수 있으므로 화면 추가 개발 없음. `KEY_LABELS`에 라벨 1줄만 추가한다.
- 프론트는 설정을 읽어 `FIELD_GRADES`를 덮어쓰되, 조회 실패/미설정 시 코드 상수를 그대로 쓴다. 직급 체계가 재개편돼도 배포 없이 대응한다.

**부서별 인원 분포** — `DashboardPage.buildDepartmentDistribution()`

```ts
const grouped = groupBy(active.filter((e) => isRealOrg(e._team)), (e) => e._team);
```

- `_div` → `_team` 으로 교체. `_team`은 전체소속명 마지막 토큰(없으면 `소속` 컬럼) 이므로 그룹웨어 부서와 일치한다.
- `buildTenureByDepartment()`(부서별 평균 근속·조기퇴사율, 인력현황 상세분석)도 같은 기준으로 `_team`으로 교체한다. "부서별"이라는 라벨을 쓰는 화면 간 기준을 어긋나게 두지 않는다.
- `buildMatrixRows()`는 법인×근무지 기준이므로 변경하지 않는다.
- 카드 헤더의 "N개 조직" 표기는 팀 수로 자동 반영된다(코드 변경 없음). 팀 수가 본부 수보다 많아 목록이 길어지므로, 상위 N개 + 스크롤 여부는 구현 시 실제 렌더 확인 후 판단한다.

### 4.6 데모 시드 재생성

`supabase/migrations/0026_demo_seed_employees.sql`(직전 작업)의 직급은 사원/주임/대리/과장/차장/부장 6단계뿐이다. 새 규칙에서는 **현장직 0명**이 되어 직군 비율 검증이 불가능하다.

`scripts/gen_demo_employees.py` 수정:
- 생산본부(생산관리팀/품질관리팀/물류팀/설비기술팀) 인원 → 직급을 `사원(기능)`/`리더`/`책임` 중에서 배정(연차에 따라 사원(기능) 다수, 리더·책임 소수)
- 그 외 전 조직 → 기존 6단계 유지
- 검증 assert 추가: 현장직 인원 수 > 0, 현장직 직급 집합이 `FIELD_GRADES`와 일치
- 재생성 후 실제 PostgreSQL에서 재검증(직전 작업과 동일 절차)

## 5. 데이터 흐름 (변경 후)

```
Supabase
 ├ employees ──listEmployees()→ deriveAll(오늘) ──┐
 ├ leave_records ──listLeave()───────────────────┤
 └ hr_events ──listHrEvents()────────────────────┤
                                                 ▼
                                          DashboardPage
                                   asOfDate state ─┐
                                                   ▼
                            deriveAllAsOf(employees, asOfDate) = snapshot
                                                   │
        ┌──────────────────────────────────────────┼─────────────────────────┐
        ▼                                          ▼                         ▼
  build{Gender,Nationality,JobType,Age}Ratio   buildAutoEvents(snapshot,   buildKPI/
  build{Position,Department}Distribution        range) + hr_events 매핑     buildMatrixRows
  buildTenureByDepartment                              │                  (onLeaveAsOf)
        └──────────────────────────────────────────────┴─────────────────────┘
                                                   ▼
                                    DashboardOverview (controlled)
```

`CalendarPage`도 동일한 `buildAutoEvents`를 쓰며, range만 표시월로 좁힌다.

## 6. 에러 처리

- `listHrEvents()` 실패 시 `[]` 반환(기존 db.ts 규약) → 대시보드는 자동일정만으로 정상 렌더. 빈 화면 없음.
- `deriveAllAsOf()`에 잘못된 날짜 문자열이 오면 `setToday()`가 `isNaN` 검사로 무시하고 오늘을 유지한다(기존 동작). 날짜 선택 UI가 팝오버 캘린더뿐이라 잘못된 값이 들어올 경로는 없다.
- 자동일정 id는 `employees.id` 기반이라 수동일정 uuid와 충돌하지 않는다. 수정·삭제 시 `hr_events`에 해당 id가 없으면 "자동 생성 일정은 수정/삭제할 수 없습니다" 안내(기존 동작 유지).

## 7. 테스트

이 프로젝트에는 단위 테스트 러너가 없다. `test/` 에는 `test-app.sh`가 Chrome DevTools로 주입하는 브라우저 E2E 스크립트(`e2e.js`/`asof.js`/`rules.js`)만 있고, 이들은 엑셀 업로드 시절 UI를 전제하므로 현재 DB 연동 화면에는 그대로 쓸 수 없다.

**새 의존성은 추가하지 않는다.** 이미 devDependency 에 있는 `tsx` 로 TS 테스트 파일을 직접 실행하고, 검증은 `node:assert` 로 한다.

```jsonc
// package.json scripts 에 1줄 추가
"test:unit": "tsx test/unit/autoEvents.ts && tsx test/unit/derive.ts && tsx test/unit/dashboard.ts"
```

테스트 파일은 `test/unit/*.ts` 에 두고, 실패 시 `assert` 가 프로세스를 비정상 종료시킨다(프레임워크·픽스처 없음).

**`test/unit/autoEvents.ts`**
1. 퇴직자의 입사일·퇴사일이 생성된다 (오류 2 회귀 방지)
2. 퇴사일 이후의 최종수습평가는 생성되지 않는다 (요청 7)
3. 생일 일정이 0건이다 (요청 6)
4. range 밖의 일정은 생성되지 않는다
5. 동일 입력 2회 호출 시 id가 동일하다

**`test/unit/derive.ts`**
6. `officeType`: `사원(기능)`/`리더`/`책임` → 현장직, `사원`·`부장`·`팀장` → 사무직 (요청 4)
7. 생산관리팀 소속이지만 직급이 `과장`이면 사무직 (규칙 교체 확인)
8. `deriveAllAsOf`: 2025-06-30 기준으로 재직자 수·나이·근속연수가 오늘 기준과 다르게 계산된다
9. `deriveAllAsOf` 호출 후 전역 `today()`가 복원된다

**`test/unit/dashboard.ts`**
10. `buildDepartmentDistribution` 결과 키가 팀명이다(본부명 아님) (요청 5)
11. `onLeaveAsOf`: 과거 기준일에서 당시 휴직 중이던 인원만 카운트된다

수동 확인(배포 후):
- 캘린더에서 일정 등록 → 대시보드 우측 캘린더에 즉시 표시
- 대시보드 기준일을 2025-06-30으로 변경 → 총원·비율분포·인원분포·집계표가 모두 변경
- 직원 soft delete → 해당 직원 자동일정 소멸

## 8. 범위 외 (별도 과제)

- `org_settings.probation_days`(1차/최종 수습평가 일수)를 `derive.ts`가 읽지 않고 상수 +30/+55로 계산하는 문제
- `DashboardOverview` 내부의 `employeeRecords` 기반 재계산과 부모 스냅샷 계산의 이중화 해소
- 부서별 정원(TO) 데이터 부재로 `fillRate`가 100 고정인 문제
- 대시보드 이외 화면(`DiversityPage`, `OrgChartPage`, `RosterPage`)의 기준일 지원 — 현재 요청 범위는 대시보드
- 기존 브라우저 E2E 스크립트(`test/e2e.js`·`asof.js`·`rules.js`)가 엑셀 업로드 시절 UI를 전제해 현재 화면에서 동작하지 않는 문제

## 8.5 구현 중 추가로 발견·수정한 것 (2026-08-27 구현 완료)

설계 후 실제 구현·테스트에서 드러난 것들이다.

1. **`_activeNow` 가 입사일을 보지 않았다** — `!quit || quit > TODAY` 라서 과거 기준일 스냅샷에서
   **아직 입사하지 않은 사람이 재직자로 집계**됐다(오늘 기준으로도 입사예정자가 총원에 포함).
   KPI 카드의 `headcountAsOf()` 는 입사일을 보므로 두 값이 서로 어긋났다.
   → `(!hire || hire <= TODAY) && (!quit || quit > TODAY)` 로 수정. `test/unit/derive.ts` 가 잡아낸 회귀다.
2. **`src/lib/stats.ts` 신설(설계에 없던 파일)** — 순수 집계 함수가 `DashboardPage.tsx` 안에 있어
   ① 인력현황·구성다양성 페이지가 대시보드 페이지를 import 하는 구조였고 ② JSX 없이 테스트할 수 없었다.
   순수 계산만 이 파일로 옮기고 세 페이지가 함께 쓴다.
3. **`DashboardPage.tsx` 에 NUL 바이트가 있었다** — `buildMatrixRows` 가 그룹 키 구분자로 제어문자를
   소스에 직접 박아 파일이 바이너리로 취급되어 grep 결과에서 조용히 누락됐다(런타임은 정상).
   `'\u001F'` 이스케이프로 교체.
4. **막대 그래프 스케일 하드코딩** — 직급/부서 분포 막대 폭이 `count/240`, `count/200` 고정 분모였다.
   부서 집계가 본부(5개)→부서(15개)로 바뀌며 항목당 인원이 작아져 막대가 사실상 보이지 않게 되므로
   최대값 기준 정규화(`barPct`)로 교체하고, 부서 목록에 `max-h-72 overflow-y-auto` 를 씌웠다.
5. **테스트 파일명** — 설계의 `test/unit/dashboard.ts` → 실제 `test/unit/stats.ts`(대상 모듈명과 일치).
6. **현장직 하위분류 '기타'** — 현장직 판정이 직급 기준이 되면서 생산/품질/물류 정규식에 걸리지 않는
   현장직(예: 설비기술팀)이 드릴다운에서 사라져 총원과 합계가 어긋났다. '기타 현장직' 버킷을 추가하고
   인원 0인 카테고리는 감춘다.

**검증 결과**: `npm run lint`(tsc) 통과, `npm run build` 통과, `npm run test:unit` 17개 검증 통과,
데모 시드 0026/0027 을 실제 PostgreSQL 16 에 적용해 총원 250 / 재직 120 / 퇴직 130,
직군 현장직 46·사무직 74, 부서 15개(생산관리팀 22명 최다), 휴직 11건 확인.

## 9. 변경 파일 요약

| 파일 | 구분 | 내용 |
|---|---|---|
| `src/lib/autoEvents.ts` | 신규 | 자동일정 생성 단일 소스(생일 제외, 재직기간 가드) |
| `test/unit/autoEvents.ts` | 신규 | 위 1~5 (tsx + node:assert) |
| `src/excel/derive.ts` | 수정 | `officeType` 직급 기반 교체, `FIELD_GRADES`, `deriveAllAsOf`, `_activeNow` 입사일 조건 |
| `test/unit/derive.ts` | 신규 | 위 6~9 |
| `src/features/calendar/CalendarPage.tsx` | 수정 | 자체 `buildAutoEvents` 삭제 → 공통 함수 호출 |
| `src/lib/stats.ts` | 신규 | 순수 집계 함수 분리(부서=팀, `onLeaveAsOf`, 기준일 인자) |
| `src/features/dashboard/DashboardPage.tsx` | 수정 | `listHrEvents` 병합, `asOfDate` 소유, 스냅샷 재파생, NUL 바이트 제거 |
| `test/unit/stats.ts` | 신규 | 위 10~11 + 집계표 구분자 |
| `package.json` | 수정 | `test:unit` 스크립트 1줄 |
| `src/components/DashboardOverview.tsx` | 수정 | `asOfDate` controlled 전환, 막대 스케일 정규화, 부서목록 스크롤 |
| `src/features/headcount/HeadcountPage.tsx` | 수정 | 하위분류 팀명 기준 유지 + '기타 현장직' 버킷 |
| `src/features/diversity/DiversityPage.tsx` | 수정 | 집계 함수 import 경로를 `lib/stats` 로 |
| `src/lib/db.ts` | 수정 | `ensureFieldGrades()` — org_settings 1회 로드 |
| `src/features/admin/OrgSettingsPage.tsx` | 수정 | `field_grades` 라벨 1줄 |
| `supabase/migrations/0027_settings_field_grades.sql` | 신규 | `org_settings.field_grades` 기본값 |
| `scripts/gen_demo_employees.py` | 수정 | 생산본부 직급을 현장직 3직급으로, assert 추가 |
| `supabase/migrations/0026_demo_seed_employees.sql` | 재생성 | 위 스크립트 재실행 결과 |
