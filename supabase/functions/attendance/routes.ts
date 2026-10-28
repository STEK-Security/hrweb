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
