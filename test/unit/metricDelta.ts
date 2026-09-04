/**
 * 핵심지표 증감 계산 — 수기 서식(콤마/%/소수) 보존 검증
 * 실행: npm run test:unit
 */
import assert from 'node:assert/strict';
import { calcDelta } from '../../src/lib/metricDelta';

// 1) 계약 예시 5개
assert.equal(calcDelta('648', '638'), '+10');
assert.equal(calcDelta('3,245,000', '3,180,500'), '+64,500', '천단위 콤마 서식이 유지되지 않음');
assert.equal(calcDelta('4', '6'), '-2');
assert.equal(calcDelta('1.02%', '0.94%'), '+0.08%', '부동소수점 꼬리가 남음');
assert.equal(calcDelta('', '638'), '-');

// 2) 0 은 접두 없이 '0'
assert.equal(calcDelta('10', '10'), '0');
assert.equal(calcDelta('1.02%', '1.02%'), '0');

// 3) 음수 소수 — 부호와 자릿수·% 유지
assert.equal(calcDelta('0.94%', '1.02%'), '-0.08%');
assert.equal(calcDelta('2.5', '3.75'), '-1.3', '소수 자릿수는 current 기준(1자리)이어야 함');

// 4) base 가 빈 문자열/파싱 불가
assert.equal(calcDelta('648', ''), '-');
assert.equal(calcDelta('648', '-'), '-');
assert.equal(calcDelta('  ', '638'), '-');

// 5) 통화기호·공백도 파싱된다
assert.equal(calcDelta('₩3,245,000', '₩3,180,500'), '+64,500');

// 6) 괄호 음수 표기는 부호를 잃으므로 계산하지 않고 '-' — 틀린 부호를 보여주는 것보다 안전하다
assert.equal(calcDelta('(500)', '(1,000)'), '-');
assert.equal(calcDelta('(500)', '300'), '-');
assert.equal(calcDelta('648', '(10)'), '-');

console.log('PASS metricDelta (16 checks)');
