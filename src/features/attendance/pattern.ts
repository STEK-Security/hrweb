/**
 * 근무조 28일 패턴 → Worker `PUT /api/admin/schedules` 행(순수 함수). 스펙 11.1·11.7.
 * 덮어쓰지 않는 칸: 오늘 이전, 마감(open 아닌) 달, 직접 수정한 칸(note 가 `pattern:` 로 시작하지 않는 기존 행).
 */

export const CODES = ['DAY', 'NIGHT', 'REST'] as const;
export const CODE_LABELS: Record<string, string> = { DAY: '주', NIGHT: '야', REST: '휴' };

/** 칸 클릭 순환: 주간 → 야간 → 휴일 → 주간. */
export const cycle = (c: string) => CODES[(CODES.indexOf(c as (typeof CODES)[number]) + 1) % CODES.length];

const dayNo = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
export const addDays = (d: string, n: number) => new Date((dayNo(d) + n) * 86_400_000).toISOString().slice(0, 10);

/** 날짜 d 의 패턴 코드. 기준일 이전(음수)도 28일 주기로. */
export const codeAt = (pattern: string[], anchor: string, d: string) =>
  pattern[(((dayNo(d) - dayNo(anchor)) % 28) + 28) % 28];

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
  if (pattern.length !== 28) throw new Error('패턴은 28일이어야 합니다');
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

