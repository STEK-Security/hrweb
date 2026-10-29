/**
 * attendance Edge Function 경로 화이트리스트 — 허용/거부 표
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import { allowed } from '../../supabase/functions/attendance/routes';

const ok: Array<[string, string]> = [
  ['GET', '/api/admin/days'],
  ['GET', '/api/admin/month'],
  ['GET', '/api/admin/matrix'],
  ['GET', '/api/admin/corrections'],
  ['GET', '/api/admin/shift-types'],
  ['GET', '/api/admin/holidays'],
  ['GET', '/api/admin/rules'],
  ['GET', '/api/admin/schedules'],
  ['GET', '/api/admin/employees'],
  ['GET', '/api/admin/confirmations'],
  ['GET', '/api/admin/export'],
  ['GET', '/api/admin/unmatched'],
  ['GET', '/api/admin/audit'],
  ['GET', '/api/admin/months'],
  ['GET', '/api/admin/months/2026-10/precheck'],
  ['GET', '/api/admin/jobs'],
  ['GET', '/api/admin/jobs/12'],
  ['GET', '/api/admin/months/2026-10/snapshot'],
  ['POST', '/api/admin/corrections/5'],
  ['POST', '/api/admin/corrections/5/revoke'],
  ['POST', '/api/admin/days/A1234/2026-10-01/edit'],
  ['POST', '/api/admin/rules'],
  ['POST', '/api/admin/recompute'],
  ['POST', '/api/admin/accounts/A1234/reset'],
  ['POST', '/api/admin/months/2026-10/close'],
  ['POST', '/api/admin/months/2026-10/reopen'],
  ['POST', '/api/admin/jobs/step'],
  ['PUT', '/api/admin/shift-types'],
  ['PUT', '/api/admin/holidays'],
  ['PUT', '/api/admin/schedules'],
  ['PATCH', '/api/admin/employees/A1234'],
];
for (const [m, p] of ok) assert.equal(allowed(m, p), true, `허용되어야 함: ${m} ${p}`);

const bad: Array<[string, string]> = [
  // Review Focus 1: 화이트리스트 밖
  ['POST', '/api/ingest/punches'],
  ['GET', '/api/ingest/punches'],
  ['GET', '/api/admin/../ingest/punches'],
  ['GET', '/api/admin/months/../../ingest'],
  ['GET', '/api/admin/days/..'],
  ['GET', 'https://evil.example/api/admin/days'],
  ['GET', '//evil.example/api/admin/days'],
  ['GET', '/api/admin//days'],
  ['GET', '/api/admin/days?x=1'],
  ['GET', '/api/admin/days#x'],
  ['GET', '/api/admin/days/'],
  ['GET', '/api/admin/ping'],
  ['GET', '/api/me'],
  ['GET', ''],
  // 메서드 불일치
  ['DELETE', '/api/admin/days'],
  ['POST', '/api/admin/days'],
  ['GET', '/api/admin/recompute'],
  ['PUT', '/api/admin/rules'],
  ['GET', '/api/admin/employees/A1234'],
  ['get', '/api/admin/days'],
  ['constructor', '/api/admin/days'],
  ['__proto__', '/api/admin/days'],
  // 세그먼트 형식
  ['GET', '/api/admin/months/2026-10/precheck/x'],
  ['POST', '/api/admin/days/A1234/2026-10-01/edit/x'],
  ['PATCH', '/api/admin/employees/'],
  ['GET', '/api/admin/jobs/a%2F..'],
  ['GET', '/api/admin/days\\..\\x'],
];
for (const [m, p] of bad) assert.equal(allowed(m, p), false, `거부되어야 함: ${m} ${p}`);

console.log(`attendanceRoutes: ${ok.length + bad.length} cases ok`);
