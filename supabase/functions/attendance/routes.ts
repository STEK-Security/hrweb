// 순수 모듈(Deno·tsx 공용) — Deno 전역이나 import 를 쓰지 않는다. test/unit/attendanceRoutes.ts 가 검증.
// Worker 정본: hr-Attendance/src/worker/routes/admin.ts (app.route('/api/admin', admin)).

const ID = '[A-Za-z0-9_-]+'; // sabun·job id·correction id — '.', '%', '\' 를 막아 인코딩 우회도 차단
const YM = '\\d{4}-\\d{2}';
const DATE = '\\d{4}-\\d{2}-\\d{2}';

const ROUTES: Record<string, string[]> = {
  GET: [
    'days', 'month', 'matrix', 'corrections', 'shift-types', 'holidays', 'rules', 'schedules',
    'employees', 'confirmations', 'export', 'unmatched', 'audit', 'months',
    `months/${YM}/precheck`, 'jobs', `jobs/${ID}`, `months/${YM}/snapshot`,
  ],
  POST: [
    `corrections/${ID}`, `days/${ID}/${DATE}/edit`, 'rules', 'recompute', `accounts/${ID}/reset`,
    `months/${YM}/close`, `months/${YM}/reopen`, 'jobs/step',
  ],
  PUT: ['shift-types', 'holidays', 'schedules'],
  PATCH: [`employees/${ID}`],
};

const COMPILED = Object.fromEntries(
  Object.entries(ROUTES).map(([m, ps]) => [m, ps.map((p) => new RegExp(`^/api/admin/${p}$`))]),
);

export function allowed(method: string, path: string): boolean {
  if (typeof path !== 'string' || !path.startsWith('/api/admin/')) return false;
  if (/\.\.|\/\/|[?#]/.test(path)) return false;
  return Object.hasOwn(COMPILED, method) && COMPILED[method].some((re) => re.test(path));
}

// 직원명부(public.employees) → Worker /api/ingest/employees 행. 필요한 열만 보낸다(주민번호·연락처 등 제외).
export type HrEmployee = {
  사번: string | null; 성명: string | null; 그룹웨어ID: string | null; 소속: string | null; 전체소속명: string | null
  직책: string | null; 입사일: string | null; 퇴직일: string | null; 근무지: string | null; 성별: string | null; 생년월일: string | null
};
export const EMPLOYEE_COLUMNS = '"사번","성명","그룹웨어ID","소속","전체소속명","직책","입사일","퇴직일","근무지","성별","생년월일"';

export function toIngestEmployee(e: HrEmployee): Record<string, string | null> | null {
  const gw = e.그룹웨어ID?.trim().split('@')[0]; // 로그인은 '@' 앞부분(이메일 로그인 시 Worker 도 같은 정규화)
  if (!e.사번?.trim() || !e.성명?.trim() || !gw) return null;
  return {
    sabun: e.사번.trim(), name: e.성명.trim(), gw_id: gw, dept: e.소속, dept_path: e.전체소속명, title: e.직책,
    hire_date: e.입사일, retire_date: e.퇴직일, site: e.근무지, gender: e.성별, birth_year: e.생년월일?.slice(0, 4) ?? null,
  };
}
