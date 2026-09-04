/** '3,180,500' | '0.94%' | '648' 같은 수기 서식 문자열의 차이를 원본(current) 서식 그대로 계산한다. */

/**
 * 콤마·공백·%·통화기호를 걷어내고 숫자만 남긴다. 빈 값/파싱 실패는 null.
 * 회계 관행인 괄호 음수 표기('(1,000)' = -1000)는 부호를 잃고 양수로 읽혀
 * 증감 부호가 정반대로 나오므로, 조용히 틀린 값을 보여주지 않도록 파싱을 거부한다.
 */
function clean(s: string): string | null {
  if (/[()]/.test(s)) return null;
  const t = s.replace(/[^0-9.-]/g, '');
  return t && Number.isFinite(Number(t)) ? t : null;
}

export function calcDelta(current: string, base: string): string {
  const c = clean(current);
  const b = clean(base);
  if (c === null || b === null) return '-';

  // 소수 자릿수는 current 기준 — 1.02 - 0.94 의 부동소수점 꼬리(0.08000000000000007)를 여기서 자른다.
  const decimals = c.split('.')[1]?.length ?? 0;
  const diff = Number((Number(c) - Number(b)).toFixed(decimals));
  if (diff === 0) return '0';

  const abs = Math.abs(diff);
  const body = current.includes(',')
    ? abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : abs.toFixed(decimals);
  return `${diff > 0 ? '+' : '-'}${body}${current.includes('%') ? '%' : ''}`;
}
