/**
 * 직원명부 → 근태 직원 적재 매핑
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import { toIngestEmployee } from '../../supabase/functions/attendance/routes';

const base = { 사번: ' 2001 ', 성명: '홍길동', 그룹웨어ID: 'gildong@stek.kr', 소속: '생산1팀', 전체소속명: 'STEK>생산본부>생산1팀', 직책: '팀장',
  입사일: '2020-03-02', 퇴직일: null, 근무지: '본사', 성별: '남', 생년월일: '1990-05-01' };
assert.deepEqual(toIngestEmployee(base), { sabun: '2001', name: '홍길동', gw_id: 'gildong', dept: '생산1팀', dept_path: 'STEK>생산본부>생산1팀',
  title: '팀장', hire_date: '2020-03-02', retire_date: null, site: '본사', gender: '남', birth_year: '1990' });
assert.equal(toIngestEmployee({ ...base, 그룹웨어ID: 'plain' })?.gw_id, 'plain');
assert.equal(toIngestEmployee({ ...base, 그룹웨어ID: null }), null); // 로그인 ID 없으면 보내지 않음
assert.equal(toIngestEmployee({ ...base, 그룹웨어ID: '@stek.kr' }), null);
assert.equal(toIngestEmployee({ ...base, 사번: ' ' }), null);
assert.equal(toIngestEmployee({ ...base, 생년월일: null })?.birth_year, null);
console.log('attendanceEmployees: ok');

import { dedupeLogins } from '../../supabase/functions/attendance/routes';
const row = (sabun: string, gw: string, retire: string | null, hire: string) => ({ ...toIngestEmployee({ ...base, 사번: sabun, 그룹웨어ID: gw, 퇴직일: retire, 입사일: hire })! });
{
  const { rows, conflicts } = dedupeLogins([row('1', 'kim@stek.kr', '2022-01-01', '2019-01-01'), row('2', 'kim@stek.kr', null, '2023-01-01'), row('3', 'lee', null, '2020-01-01')]);
  assert.deepEqual(rows.map((r) => r.gw_id), ['kim~1', 'kim', 'lee']); // 재직자가 ID 를 가진다
  assert.deepEqual(conflicts, []);
}
{
  const { rows, conflicts } = dedupeLogins([row('5', 'park@a.com', null, '2020-01-01'), row('6', 'park@b.com', null, '2024-01-01')]);
  assert.deepEqual(rows.map((r) => r.gw_id), ['park~5', 'park']); // 둘 다 재직 → 최근 입사자
  assert.deepEqual(conflicts, [['6', '5']]);
}
console.log('attendanceEmployees dedupe: ok');
