/**
 * 근무조 28일 패턴 → 근무표 행 (Review Focus 3: 마감 달·지난 날·직접 수정한 칸은 덮어쓰지 않음)
 * 실행: bun run test:unit
 */
import assert from 'node:assert/strict';
import { buildCells, codeAt, cycle } from '../../src/features/attendance/pattern';

const A = [
  ...Array(5).fill('DAY'), 'REST', 'REST', ...Array(5).fill('DAY'), 'REST', 'REST',
  ...Array(5).fill('NIGHT'), 'REST', 'REST', ...Array(5).fill('NIGHT'), 'REST', 'REST',
];
const anchor = '2026-11-02';

// 모듈러: 기준일 이전(음수 차이)도 28일 주기로
assert.equal(codeAt(A, anchor, '2026-11-02'), 'DAY');
assert.equal(codeAt(A, anchor, '2026-11-07'), 'REST');
assert.equal(codeAt(A, anchor, '2026-11-16'), 'NIGHT');
assert.equal(codeAt(A, anchor, '2026-11-30'), 'DAY', '28일 뒤 = 1일차');
assert.equal(codeAt(A, anchor, '2026-11-01'), 'REST', '기준일 하루 전 = 28일차');
assert.equal(codeAt(A, anchor, '2026-10-19'), 'NIGHT', '기준일 14일 전 = 15일차');
assert.equal(codeAt(A, anchor, '2025-11-03'), A[((-364 % 28) + 28) % 28], '1년 전');

assert.equal(cycle('DAY'), 'NIGHT');
assert.equal(cycle('NIGHT'), 'REST');
assert.equal(cycle('REST'), 'DAY');

const base = { holidays: new Set<string>(), holidayAsRest: true, today: '2026-11-02', closedYms: new Set<string>() };

// 기본: 2명 × 3일, note = pattern:<조>, PUT 행 모양
{
  const r = buildCells(A, anchor, '2026-11-02', '2026-11-04', ['1001', '1002'], [], { ...base, group: 'A조' });
  assert.equal(r.rows.length, 6);
  assert.deepEqual(r.rows[0], { sabun: '1001', work_date: '2026-11-02', shift_code: 'DAY', note: 'pattern:A조' });
}

// 공휴일 → REST (체크 시), 체크 해제면 패턴 그대로
{
  const holidays = new Set(['2026-11-03']);
  const on = buildCells(A, anchor, '2026-11-03', '2026-11-03', ['1001'], [], { ...base, holidays, group: 'A조' });
  assert.equal(on.rows[0].shift_code, 'REST');
  const off = buildCells(A, anchor, '2026-11-03', '2026-11-03', ['1001'], [], { ...base, holidays, holidayAsRest: false, group: 'A조' });
  assert.equal(off.rows[0].shift_code, 'DAY');
}

// 오늘 이전 제외(오늘은 포함)
{
  const r = buildCells(A, anchor, '2026-11-01', '2026-11-02', ['1001'], [], { ...base, group: 'A조' });
  assert.deepEqual(r.rows.map((x) => x.work_date), ['2026-11-02']);
  assert.equal(r.skipped.past, 1);
}

// 마감 달 제외
{
  const r = buildCells(A, anchor, '2026-11-30', '2026-12-01', ['1001'], [], { ...base, closedYms: new Set(['2026-12']), group: 'A조' });
  assert.deepEqual(r.rows.map((x) => x.work_date), ['2026-11-30']);
  assert.equal(r.skipped.closed, 1);
}

// 직접 수정한 칸 보존 / 패턴으로 넣은 칸은 덮어씀 / 같은 값은 보내지 않음
{
  const existing = [
    { sabun: '1001', work_date: '2026-11-02', shift_code: 'NIGHT', note: null }, // 직접 수정
    { sabun: '1001', work_date: '2026-11-03', shift_code: 'NIGHT', note: 'pattern:B조' }, // 다른 조 패턴(조 이동) → 덮어씀
    { sabun: '1001', work_date: '2026-11-04', shift_code: 'DAY', note: 'pattern:A조' }, // 이미 같음
    { sabun: '1001', work_date: '2026-11-05', shift_code: 'REST', note: 'hr' }, // 직접 수정
  ];
  const r = buildCells(A, anchor, '2026-11-02', '2026-11-05', ['1001'], existing, { ...base, group: 'A조' });
  assert.deepEqual(r.rows.map((x) => `${x.work_date}:${x.shift_code}`), ['2026-11-03:DAY']);
  assert.equal(r.skipped.manual, 2);
  assert.equal(r.skipped.same, 1);
}

// 패턴 길이 검사
assert.throws(() => buildCells(['DAY'], anchor, '2026-11-02', '2026-11-02', ['1001'], [], { ...base, group: 'A조' }));

console.log('PASS attendancePattern (24 checks)');
