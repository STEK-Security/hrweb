/**
 * 근무조 4주(28일)·5주(35일) 패턴 → Worker `PUT /api/admin/schedules` 행(순수 함수). 스펙 11.1·11.7.
 * 덮어쓰지 않는 칸: 오늘 이전, 마감(open 아닌) 달, 직접 수정한 칸(note 가 `pattern:` 로 시작하지 않는 기존 행).
 */

/** DAY_STD = 통상주간(생산·품질 주간 근무자 08:00~17:00). 근무유형(shift_types)에 같은 코드가 있어야 저장된다. */
export const CODES = ['DAY', 'NIGHT', 'REST', 'DAY_STD'] as const;
export const CODE_LABELS: Record<string, string> = { DAY: '주', NIGHT: '야', REST: '휴', DAY_STD: '통' };

/** 칸 클릭 순환: 주간 → 야간 → 휴일 → 통상주간 → 주간. */
export const cycle = (c: string) => CODES[(CODES.indexOf(c as (typeof CODES)[number]) + 1) % CODES.length];

const dayNo = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
export const addDays = (d: string, n: number) => new Date((dayNo(d) + n) * 86_400_000).toISOString().slice(0, 10);
/** 그 주 월요일. 패턴 1일차는 월요일이다(인사팀 기준표: 5일차 금, 6·7일차 토·일). */
export const mondayOf = (d: string) => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));

/** '20:00' → '오후 8:00', '00:00' → '오전 12:00' */
export const ampm = (hm: string | null) => {
  if (!hm) return '';
  const h = +hm.slice(0, 2);
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${hm.slice(3, 5)}`;
};

/** 패턴 주 수. DB 제약(0037)과 같게 4주·5주만. */
export const WEEK_OPTIONS = [4, 5] as const;
export const isPatternLength = (n: number) => WEEK_OPTIONS.some((w) => w * 7 === n);

/** 새 근무조 패턴: 전부 휴일. */
export const newPattern = (weeks: number) => Array<string>(weeks * 7).fill('REST');

/** 주 수 바꾸기: 늘리면 기본 주간 주(월~금 주간, 토·일 휴일)를 붙이고, 줄이면 뒤 주를 버린다. */
export const resizeWeeks = (pattern: string[], weeks: number) => {
  const out = pattern.slice(0, weeks * 7);
  while (out.length < weeks * 7) out.push(...weekBlock('DAY'));
  return out;
};

/** 한 주 블록: 근무 코드면 월~금 그 근무 + 토·일 휴일(인사팀 기준표), 휴일이면 7일 휴일. */
export const weekBlock = (code: string) => (code === 'REST' ? Array<string>(7).fill('REST') : [...Array<string>(5).fill(code), 'REST', 'REST']);
export const fromWeeks = (weeks: string[]) => weeks.flatMap(weekBlock);
/** 패턴을 주별 코드로. 주 블록 모양(월~금 같은 근무 + 토·일 휴일, 또는 7일 휴일)이 아니면 null. */
export const weeksOf = (pattern: string[]) =>
  Array.from({ length: pattern.length / 7 }, (_, i) => {
    const w = pattern.slice(i * 7, i * 7 + 7);
    return weekBlock(w[0]).every((c, k) => c === w[k]) ? w[0] : null;
  });

/** 4주 템플릿: 주간(주)·야간(야) 주 순서 16가지 전부. 이름 글자 = 1주차부터. */
export const TEMPLATES: { name: string; weeks: string[] }[] = Array.from({ length: 16 }, (_, n) => {
  const weeks = [3, 2, 1, 0].map((b) => ((n >> b) & 1 ? 'NIGHT' : 'DAY'));
  return { name: weeks.map((w) => (w === 'NIGHT' ? '야' : '주')).join(''), weeks };
});
/** 템플릿 → 패턴. 5주 근무조면 5주차는 기본 주간(인사팀이 고쳐 쓴다). */
export const applyTemplate = (weeks: string[], days: number) => {
  const n = days / 7;
  return fromWeeks([...weeks, ...Array<string>(Math.max(0, n - weeks.length)).fill('DAY')].slice(0, n));
};
/** 검색어('주야주주', '1주 야 2주 주', '야 주')에서 주·야 순서만 뽑아 앞부분이 같은 템플릿. */
export const searchTemplates = (q: string) => {
  const key = [...q.replace(/\d\s*주(차)?/g, '')].filter((c) => c === '주' || c === '야').join('');
  return TEMPLATES.filter((t) => t.name.startsWith(key));
};

/** 날짜 d 의 패턴 코드. 기준일 이전(음수)도 패턴 길이 주기로. */
export const codeAt = (pattern: string[], anchor: string, d: string) =>
  pattern[(((dayNo(d) - dayNo(anchor)) % pattern.length) + pattern.length) % pattern.length];

export interface ExistingRow {
  sabun: string;
  work_date: string;
  shift_code: string;
  note?: string | null;
}
export interface PatternRow {
  sabun: string;
  work_date: string;
  shift_code: string;
  note: string;
}
export interface BuildOpts {
  group: string;
  holidays: Set<string>;
  holidayAsRest: boolean;
  /** KST 'YYYY-MM-DD' */
  today: string;
  closedYms: Set<string>;
  /** 지난 날도 채운다(열린 달만). 도입 첫 달 소급용. */
  includePast?: boolean;
}

export function buildCells(
  pattern: string[],
  anchor: string,
  from: string,
  to: string,
  sabuns: string[],
  existing: ExistingRow[],
  opts: BuildOpts,
) {
  if (!isPatternLength(pattern.length)) throw new Error('패턴은 4주(28일) 또는 5주(35일)여야 합니다');
  const ex = new Map(existing.map((r) => [`${r.sabun}|${r.work_date}`, r]));
  const rows: PatternRow[] = [];
  const skipped = { past: 0, closed: 0, manual: 0, same: 0 };
  const note = `pattern:${opts.group}`;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const code = opts.holidayAsRest && opts.holidays.has(d) ? 'REST' : codeAt(pattern, anchor, d);
    for (const sabun of sabuns) {
      const old = ex.get(`${sabun}|${d}`);
      if (d < opts.today && !opts.includePast) skipped.past++;
      else if (opts.closedYms.has(d.slice(0, 7))) skipped.closed++;
      else if (old && !old.note?.startsWith('pattern:')) skipped.manual++;
      else if (old?.shift_code === code) skipped.same++;
      else rows.push({ sabun, work_date: d, shift_code: code, note });
    }
  }
  return { rows, skipped };
}

