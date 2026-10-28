/**
 * 근태 현황 칸 표시·월 이동 규칙
 * 실행: bun run test:unit
 */
import assert from 'node:assert/strict';
import { cellLabel, cellWarnings, shiftYm, hm, errorText } from '../../src/features/attendance/labels';

assert.equal(shiftYm('2026-01', -1), '2025-12');
assert.equal(shiftYm('2026-12', 1), '2027-01');
assert.equal(shiftYm('2026-10', 0), '2026-10');

assert.equal(cellLabel(undefined), '');
assert.equal(cellLabel({ shift: 'DAY', status: 'normal' }), '주');
assert.equal(cellLabel({ shift: 'NIGHT', status: 'scheduled' }), '야');
assert.equal(cellLabel({ shift: 'REST', status: 'off' }), '휴');
assert.equal(cellLabel({ shift: 'DAY', status: 'leave' }), '연');
assert.equal(cellLabel({ shift: 'DAY', status: 'missing' }), '!');
assert.equal(cellLabel({ shift: null, status: 'none' }), '');

assert.deepEqual(cellWarnings({ shift: 'DAY', status: 'normal' }), []);
assert.deepEqual(cellWarnings({ shift: null, status: 'off_worked' }), ['off_day_work']);
assert.deepEqual(cellWarnings({ shift: 'DAY', status: 'normal', flags: ['break_short'] }), ['break_short'], 'flags 가 오면 그대로');

assert.equal(hm(485), '8:05');
assert.equal(errorText({ code: 'MONTH_CLOSED', message: 'x' }), '마감된 달은 수정할 수 없습니다.');
assert.equal(errorText(new Error('네트워크')), '네트워크');

console.log('PASS attendanceLabels (17 checks)');
