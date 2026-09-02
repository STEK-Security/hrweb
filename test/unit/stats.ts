/**
 * 집계 기준(부서=팀) + 기준일 휴직 판정 검증
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import { deriveAll, deriveAllAsOf, setToday } from '../../src/excel/derive';
import type { RawRow } from '../../src/excel/parse';
import type { LeaveRecord } from '../../src/lib/db';
import {
  buildDepartmentDistribution,
  buildKPI,
  buildMatrixRows,
  buildTurnoverRates,
  onLeaveAsOf,
} from '../../src/lib/stats';

setToday('2026-08-27');

const row = (over: Record<string, string>): RawRow =>
  ({
    성명: '홍길동',
    사번: 'S0001',
    법인: '스텍오토모티브',
    소속: '생산관리팀',
    전체소속명: '스텍오토모티브 > 생산본부 > 생산관리팀',
    직급: '사원',
    직책: '사원',
    근무지: '천안 공장',
    성별: '남',
    생년월일: '1990-05-10',
    입사일: '2024-03-04',
    ...over,
  }) as RawRow;

const rows = [
  row({ 사번: 'S1', 소속: '생산관리팀', 전체소속명: '스텍오토모티브 > 생산본부 > 생산관리팀' }),
  row({ 사번: 'S2', 소속: '품질관리팀', 전체소속명: '스텍오토모티브 > 생산본부 > 품질관리팀' }),
  row({ 사번: 'S3', 소속: '인사총무팀', 전체소속명: '스텍오토모티브 > 경영지원본부 > 인사총무팀' }),
];
const emps = deriveAll(rows);
const active = emps.filter((e) => e._activeNow);

// 1) 부서별 인원 분포의 키는 팀명이다(본부명 아님)
const dist = buildDepartmentDistribution(active);
const names = dist.map((d) => d.name).sort();
assert.deepEqual(names, ['생산관리팀', '인사총무팀', '품질관리팀'], '부서 집계 단위가 팀이 아님');
assert.ok(!names.includes('생산본부'), '본부 기준 집계가 남아 있음');

// 2) onLeaveAsOf — 기준일 시점 휴직만 카운트
const lv = (over: Partial<LeaveRecord>): LeaveRecord =>
  ({
    id: 'L1',
    employee_id: 'E1',
    name: '홍길동',
    dept: '생산관리팀',
    position: '사원',
    reason: '육아휴직',
    start_date: '2025-01-06',
    expected_return_date: '2025-12-31',
    substitute_assigned: false,
    substitute_name: null,
    contact: null,
    status: '복직완료',
    created_at: '2025-01-06T00:00:00Z',
    updated_at: '2025-01-06T00:00:00Z',
    ...over,
  }) as LeaveRecord;

const past = lv({}); // 2025-01-06 ~ 2025-12-31
const current = lv({
  id: 'L2',
  start_date: '2026-05-01',
  expected_return_date: '2027-04-30',
  status: '휴직중',
});

assert.equal(onLeaveAsOf(past, '2025-06-30'), true, '당시 휴직자가 빠짐');
assert.equal(onLeaveAsOf(past, '2026-08-27'), false, '복직 완료자가 휴직으로 잡힘');
assert.equal(onLeaveAsOf(current, '2026-08-27'), true, '현재 휴직자가 빠짐');
assert.equal(onLeaveAsOf(current, '2025-06-30'), false, '휴직 시작 전인데 휴직으로 잡힘');

// 3) buildKPI 의 휴직자 수·재직자 수가 기준일에 반응한다
const kpiNow = buildKPI(emps, [past, current], '2026-08-27');
const kpiPast = buildKPI(deriveAllAsOf(rows, '2025-06-30'), [past, current], '2025-06-30');
assert.equal(kpiNow.leaveOfAbsenceCount, 1);
assert.equal(kpiPast.leaveOfAbsenceCount, 1);
assert.equal(kpiPast.totalEmployees, 3, '2025-06-30 기준 재직자 수 오류');

// 4) 인원집계 현황표 — 법인/근무지가 공백 포함이어도 분리된다
const matrix = buildMatrixRows(emps, [current], '2026-08-27');
assert.equal(matrix.length, 1);
assert.equal(matrix[0].corporation, '스텍오토모티브');
assert.equal(matrix[0].location, '천안 공장', '근무지 파싱 오류(구분자 문제)');
assert.equal(matrix[0].totalCount, 3);

// 5) 퇴사율 명세 — 분모=(연초+연말 재직자)/2, 조기=당해 퇴사자 중 근속 365일 미만
const rec = (hireDate: string | null, quitDate: string | null) => ({ hireDate, quitDate });
const turnoverRecs = [
  rec('2023-01-01', null),        // 연초·연말 모두 재직
  rec('2025-06-01', '2026-03-01'), // 연초 재직 → 당해 퇴사(근속 273일, 조기)
  rec('2026-02-01', '2026-02-01'), // 입사 당일 퇴사(근속 0일, 조기)
  rec('2024-01-01', '2026-08-01'), // 당해 퇴사(근속 943일, 조기 아님)
  rec('2026-01-05', null),         // 당해 입사 → 연말만 재직
];
const tr = buildTurnoverRates(turnoverRecs, '2026-08-27');
assert.equal(tr.startHeadcount, 3, '연초 재직자 수 오류');
assert.equal(tr.endHeadcount, 2, '기준일 재직자 수 오류(진행 중 연도 clamp)');
assert.equal(tr.leavers, 3, '당해 퇴사자 수 오류');
assert.equal(tr.earlyLeavers, 2, '조기 퇴사자 수 오류(입사 당일 퇴사 포함)');
assert.equal(tr.annualRate, 120, '연간 누적 퇴사율 오류');
assert.equal(tr.earlyRate, 66.67, '조기 퇴사율 오류(ROUND 2자리)');

// 6) 경계값 — 근속 365일은 조기 아님 / 퇴사자 0명·재직자 0명이면 0%
const bound = buildTurnoverRates(
  [rec('2025-01-01', '2026-01-01'), rec('2025-01-02', '2026-01-01'), rec('2024-01-01', null)],
  '2026-12-31'
);
assert.equal(bound.leavers, 2);
assert.equal(bound.earlyLeavers, 1, '근속 365일이 조기 퇴사로 잡힘');
assert.equal(buildTurnoverRates([], '2026-08-27').annualRate, 0, '분모 0에서 0% 아님');
assert.equal(buildTurnoverRates([rec('2020-01-01', null)], '2026-08-27').earlyRate, 0);

console.log('PASS stats (6 checks)');
