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
