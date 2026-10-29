/**
 * 근무조 4·5주 패턴 → 근무표 행 (Review Focus 3: 마감 달·지난 날·직접 수정한 칸은 덮어쓰지 않음)
 * 실행: bun run test:unit
 */
import assert from 'node:assert/strict';
import { addDays, ampm, buildCells, codeAt, applyTemplate, cycle, fromWeeks, mondayOf, newPattern, resizeWeeks, searchTemplates, TEMPLATES, weekBlock, weeksOf } from '../../src/features/attendance/pattern';

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
assert.equal(cycle('REST'), 'DAY_STD');

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
  // 지난 날 포함: 도입 첫 달처럼 열린 달의 지난 날을 채운다(마감 달은 계속 제외)
  const p = buildCells(A, anchor, '2026-10-31', '2026-11-02', ['1001'], [], { ...base, includePast: true, closedYms: new Set(['2026-10']), group: 'A조' });
  assert.deepEqual(p.rows.map((x) => x.work_date), ['2026-11-01', '2026-11-02']);
  assert.equal(p.skipped.past, 0);
  assert.equal(p.skipped.closed, 1);
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

// 1일차 = 그 주 월요일(목요일로 잘못 저장된 기준일 → 같은 주 월요일)
assert.equal(mondayOf('2026-10-29'), '2026-10-26');
assert.equal(mondayOf('2026-11-02'), '2026-11-02');
assert.equal(mondayOf('2026-11-08'), '2026-11-02'); // 일요일은 앞 주 월요일
// 월요일 기준이면 6·7일차가 토·일
assert.equal(codeAt(A, mondayOf('2026-10-29'), '2026-10-31'), 'REST');
assert.equal(codeAt(A, mondayOf('2026-10-29'), '2026-10-30'), 'DAY');
// 오전/오후 표기
assert.equal(ampm('20:00'), '오후 8:00');
assert.equal(ampm('08:00'), '오전 8:00');
assert.equal(ampm('00:00'), '오전 12:00');
assert.equal(ampm('12:30'), '오후 12:30');
assert.equal(ampm(null), '');
// 통상주간도 순환에 들어간다
assert.equal(cycle('DAY_STD'), 'DAY');

// 5주(35일) 패턴: 35일 주기로 돈다
{
  const B5 = [...A, ...Array(7).fill('DAY')]; // 5주차 = 주간
  assert.equal(codeAt(B5, anchor, addDays(anchor, 28)), 'DAY');
  assert.equal(codeAt(B5, anchor, addDays(anchor, 35)), 'DAY'); // 다시 1주차 월
  assert.equal(codeAt(B5, anchor, addDays(anchor, 35 + 14)), 'NIGHT'); // 3주차 월
  assert.equal(codeAt(B5, anchor, addDays(anchor, -1)), 'DAY'); // 앞 주기 5주차 일
  const r = buildCells(B5, anchor, addDays(anchor, 28), addDays(anchor, 34), ['1001'], [], { ...base, group: 'Q' });
  assert.equal(r.rows.length, 7);
  // 주 수 바꾸기: 4→5주는 주간 주를 붙이고, 5→4주는 5주차를 버린다
  assert.deepEqual(resizeWeeks(A, 5), [...A, 'DAY', 'DAY', 'DAY', 'DAY', 'DAY', 'REST', 'REST']);
  assert.deepEqual(resizeWeeks(B5, 4), A);
  assert.deepEqual(resizeWeeks(A, 4), A);
  assert.equal(newPattern(4).length, 28);
  assert.equal(newPattern(5).length, 35);
  assert.equal(newPattern(5)[34], 'REST');
}

// 주 단위 템플릿: 한 주 = 월~금 근무 + 토·일 휴일
{
  assert.deepEqual(weekBlock('NIGHT'), ['NIGHT', 'NIGHT', 'NIGHT', 'NIGHT', 'NIGHT', 'REST', 'REST']);
  assert.deepEqual(weekBlock('REST'), Array(7).fill('REST'));
  assert.deepEqual(fromWeeks(['DAY', 'DAY', 'NIGHT', 'NIGHT']), A);
  assert.deepEqual(weeksOf(A), ['DAY', 'DAY', 'NIGHT', 'NIGHT']);
  assert.deepEqual(weeksOf(['NIGHT', ...A.slice(1)]), [null, 'DAY', 'NIGHT', 'NIGHT'], '주 안이 섞이면 null');
  assert.equal(TEMPLATES.length, 16);
  assert.equal(new Set(TEMPLATES.map((t) => t.name)).size, 16, '이름 중복 없음');
  assert.deepEqual(TEMPLATES.find((t) => t.name === '야주주주')!.weeks, ['NIGHT', 'DAY', 'DAY', 'DAY']);
  // 5주 근무조에 4주 템플릿 → 5주차는 주간
  assert.deepEqual(weeksOf(applyTemplate(['NIGHT', 'DAY', 'NIGHT', 'DAY'], 35)), ['NIGHT', 'DAY', 'NIGHT', 'DAY', 'DAY']);
  assert.equal(applyTemplate(['NIGHT', 'DAY', 'NIGHT', 'DAY'], 28).length, 28);
  // 검색: 글자 순서, '1주 야' 형식, 앞부분 일치
  assert.deepEqual(searchTemplates('주야주주').map((t) => t.name), ['주야주주']);
  assert.deepEqual(searchTemplates('1주 야 2주 주 3주 주 4주 주').map((t) => t.name), ['야주주주']);
  assert.equal(searchTemplates('야야').length, 4);
  assert.equal(searchTemplates('').length, 16);
}

// 패턴 길이 검사
assert.throws(() => buildCells(Array(29).fill('DAY'), anchor, '2026-11-02', '2026-11-02', ['1001'], [], { ...base, group: 'A조' }));

console.log('PASS attendancePattern (69 checks)');
