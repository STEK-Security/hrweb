/**
 * 분류기준(현장직 직급) + 기준일 스냅샷 파생 검증
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import {
  deriveAll,
  deriveAllAsOf,
  setToday,
  today,
  localISO,
  setFieldGrades,
  fieldGrades,
  DEFAULT_FIELD_GRADES,
} from '../../src/excel/derive';
import type { RawRow } from '../../src/excel/parse';

setToday('2026-08-27');

const row = (over: Record<string, string>): RawRow =>
  ({
    성명: '홍길동',
    사번: 'X0001',
    법인: '스텍오토모티브',
    소속: '생산관리팀',
    전체소속명: '스텍오토모티브 > 생산본부 > 생산관리팀',
    직급: '사원',
    직책: '사원',
    근무지: '천안 공장',
    생년월일: '1994-01-15',
    입사일: '2024-06-03',
    ...over,
  }) as RawRow;

// 1) 현장직 직급 3개만 현장직
const byGrade = deriveAll([
  row({ 사번: 'G1', 직급: '사원(기능)' }),
  row({ 사번: 'G2', 직급: '리더' }),
  row({ 사번: 'G3', 직급: '책임' }),
  row({ 사번: 'G4', 직급: '사원' }),
  row({ 사번: 'G5', 직급: '부장' }),
]);
assert.deepEqual(
  byGrade.map((e) => e._office),
  ['현장직', '현장직', '현장직', '사무직', '사무직'],
  '직급 기준 현장직 판정 오류'
);

// 2) 생산관리팀이라도 직급이 과장이면 사무직 (구 규칙 /생산|품질|물류/ 폐기 확인)
const [mgrInProduction] = deriveAll([row({ 사번: 'G6', 직급: '과장', 소속: '생산관리팀' })]);
assert.equal(mgrInProduction._office, '사무직', '소속명 기준 판정이 남아 있음');

// 3) 사무실 소속이라도 직급이 리더면 현장직
const [leaderInOffice] = deriveAll([
  row({
    사번: 'G7',
    직급: '리더',
    소속: '인사총무팀',
    전체소속명: '스텍오토모티브 > 경영지원본부 > 인사총무팀',
  }),
]);
assert.equal(leaderInOffice._office, '현장직', '직급 리더가 현장직으로 잡히지 않음');

// 4) org_settings 로 직급 목록 덮어쓰기 / 빈 값이면 기본값 복귀
setFieldGrades(['기능직']);
assert.deepEqual(fieldGrades(), ['기능직']);
assert.equal(deriveAll([row({ 직급: '기능직' })])[0]._office, '현장직');
assert.equal(deriveAll([row({ 직급: '리더' })])[0]._office, '사무직');
setFieldGrades([]);
assert.deepEqual(fieldGrades(), DEFAULT_FIELD_GRADES, '빈 설정에서 기본값 복귀 실패');

// 5) deriveAllAsOf — 기준일 시점 재직여부·나이·근속
const staff = [
  row({ 사번: 'A1', 입사일: '2024-01-08', 퇴직일: '2025-09-30' }), // 2025-06-30 재직 / 오늘 퇴직
  row({ 사번: 'A2', 입사일: '2026-03-02' }), // 2025-06-30 시점 미입사
];
const nowSnap = deriveAll(staff);
assert.deepEqual(
  nowSnap.map((e) => e._activeNow),
  [false, true]
);

const pastSnap = deriveAllAsOf(staff, '2025-06-30');
assert.deepEqual(
  pastSnap.map((e) => e._activeNow),
  [true, false],
  '기준일 시점 재직 판정 오류'
);
assert.ok(
  (pastSnap[0]._tenure as number) < (nowSnap[0]._tenure as number),
  '과거 기준일 근속연수가 줄지 않음'
);
assert.equal(pastSnap[0]._age, 31, '기준일 기준 나이 오류'); // 1994-01-15 → 2025-06-30 만 31세
assert.equal(nowSnap[0]._age, 32);

// 6) 전역 기준일이 호출 전 값으로 복원된다
assert.equal(localISO(today()), '2026-08-27', 'deriveAllAsOf 후 전역 기준일이 복원되지 않음');

console.log('PASS derive (6 checks)');
