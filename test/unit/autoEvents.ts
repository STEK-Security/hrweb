/**
 * 자동일정 생성 규칙 검증 (tsx + node:assert, 러너·프레임워크 없음)
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import { deriveAll, setToday } from '../../src/excel/derive';
import type { RawRow } from '../../src/excel/parse';
import { buildAutoEvents, monthRange, yearSpanRange } from '../../src/lib/autoEvents';

setToday('2026-08-27'); // 기준일 고정

const row = (over: Record<string, string>): RawRow =>
  ({
    성명: '홍길동',
    사번: 'T0001',
    법인: '스텍오토모티브',
    소속: '생산관리팀',
    전체소속명: '스텍오토모티브 > 생산본부 > 생산관리팀',
    직급: '사원',
    직책: '사원',
    근무지: '천안 공장',
    생년월일: '1990-05-10',
    입사일: '2024-03-04',
    ...over,
  }) as RawRow;

// 입사 2025-03-04 → 1차평가 2025-04-03 / 최종평가 2025-04-28. 퇴사일을 그 사이(2025-04-10)로 둔다.
// (대시보드 range 는 기준연도 ±1년이라 2025~2027 안에 있어야 생성된다)
const retiredEarly = row({ 성명: '퇴사자', 사번: 'T0002', 입사일: '2025-03-04', 퇴직일: '2025-04-10' });
const activeNew = row({ 성명: '신입', 사번: 'T0003', 입사일: '2026-08-03' });
const quitPlanned = row({ 성명: '퇴사예정', 사번: 'T0004', 입사일: '2025-01-06', 퇴직일: '2026-09-15' });

const emps = deriveAll([retiredEarly, activeNew, quitPlanned]);
const wide = buildAutoEvents(emps, yearSpanRange(2026), '2026-08-27');
const titles = wide.map((e) => e.title);

// 1) 퇴직자의 입사일·퇴사일이 생성된다 (캘린더에서 누락되던 회귀)
assert.ok(titles.includes('퇴사자 입사'), '퇴직자 입사일 누락');
assert.ok(titles.includes('퇴사자 퇴사'), '퇴직자 퇴사일 누락');

// 2) 퇴사일 이후의 최종수습평가는 생성되지 않는다 (1차는 생성)
assert.ok(titles.includes('퇴사자 1차 수습평가'), '재직 중 1차 수습평가가 누락됨');
assert.ok(!titles.includes('퇴사자 최종 수습평가'), '퇴사 후 최종 수습평가가 생성됨');

// 3) 생일 자동일정은 0건
assert.equal(titles.filter((t) => t.includes('생일')).length, 0, '생일 자동일정이 남아 있음');

// 4) range 밖의 일정은 생성되지 않는다 (2026-08 한 달 → 2025년 이벤트 없음)
const aug = buildAutoEvents(emps, monthRange(2026, 8), '2026-08-27');
assert.ok(
  aug.every((e) => e.date >= '2026-08-01' && e.date <= '2026-08-31'),
  'range 밖 이벤트가 생성됨'
);
assert.ok(
  aug.some((e) => e.title === '신입 입사'),
  '표시월 입사일이 누락됨'
);

// 5) 동일 입력 2회 호출 시 id 가 동일하다(재렌더 시 key 안정)
assert.deepEqual(
  buildAutoEvents(emps, yearSpanRange(2026), '2026-08-27').map((e) => e.id),
  wide.map((e) => e.id),
  '자동일정 id 가 호출마다 바뀜'
);

// 6) 미래 퇴사일은 (예정) 으로 표기
assert.ok(titles.includes('퇴사예정 퇴사(예정)'), '미래 퇴사일 (예정) 표기 누락');

// 7) 계약종료일도 재직기간 내에서만
const contractAfterQuit = row({
  성명: '계약자',
  사번: 'T0005',
  입사일: '2025-03-03',
  퇴직일: '2026-01-31',
  계약종료일: '2026-03-02',
});
const c = buildAutoEvents(deriveAll([contractAfterQuit]), yearSpanRange(2026), '2026-08-27');
assert.ok(!c.some((e) => e.title.includes('계약 종료')), '퇴사 후 계약종료 일정이 생성됨');

console.log('PASS autoEvents (7 checks)');
