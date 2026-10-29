/**
 * 근태관리 화면의 한국어 이름표와 칸 표시 규칙(순수 함수). 이름표는 이 파일 하나에만 둔다.
 * 코드 원본: hr-Attendance src/engine/judge.ts·week.ts(flags), types.ts(DayStatus·MinuteKey).
 */

export const FLAG_LABELS: Record<string, string> = {
  beyond_shift: '종업 이후 근로',
  missing_in: '출근 누락',
  missing_out: '퇴근 누락',
  break_short: '휴게 부족',
  off_day_work: '근무표 없는 날 근무',
  weekly_52: '주 52시간 초과',
  absent: '결근',
  holiday_no_show: '휴일 근무 미출근',
  unapproved_extra: '미승인 연장',
  invalid_times: '출퇴근 시각 오류',
  unknown_leave_type: '알 수 없는 휴가 종류',
  night_no_consent: '야간근로 미동의',
  minor_night: '연소자 야간근로',
  // flags 없는 칸의 상태에서 끌어낸 경고(cellWarnings)
  missing: '출퇴근 누락',
};

export const STATUS_LABELS: Record<string, string> = {
  normal: '정상',
  late: '지각',
  early: '조퇴',
  missing: '누락',
  absent: '결근',
  leave: '휴가',
  off: '휴무',
  off_worked: '휴무일 근무',
  none: '기록 없음',
  scheduled: '예정',
  working: '근무 중',
};

export const MINUTE_LABELS: Record<string, string> = {
  regular: '기본',
  overtime: '연장',
  night: '야간',
  holiday_le8: '휴일(8h 이내)',
  holiday_gt8: '휴일(8h 초과)',
  holiday_paid: '유급휴일',
  late: '지각',
  early_leave: '조퇴',
  absent: '결근',
  leave_paid: '유급휴가',
  leave_unpaid: '무급휴가',
  unapproved_extra: '미승인 연장',
  in_law_extra: '법정 외 연장',
};

export const SOURCE_LABELS: Record<string, string> = {
  punch: '단말기',
  correction: '정정 승인',
  hr_edit: 'HR 수정',
};

export const MONTH_STATUS_LABELS: Record<string, string> = {
  open: '진행 중',
  closing: '마감 중',
  closed: '마감',
};

export const ERROR_LABELS: Record<string, string> = {
  VALIDATION: '입력값을 확인하세요.',
  NOT_FOUND: '대상을 찾을 수 없습니다.',
  MONTH_CLOSED: '마감된 달은 수정할 수 없습니다.',
  ALREADY_CLOSED: '이미 마감된 달입니다.',
  ALREADY_CLOSING: '이미 마감 중인 달입니다.',
  NOT_CLOSED: '마감되지 않은 달입니다.',
  ACTOR_REQUIRED: '처리자 정보가 필요합니다. 다시 로그인하세요.',
  UNAUTHORIZED: '인증이 필요합니다. 다시 로그인하세요.',
  FORBIDDEN: '권한이 없습니다.',
  CLOSED_MONTH_RULE: '적용 시작 월은 마지막 마감 달 이후여야 합니다.',
};

/** AttendanceError·기타 오류를 화면 문구로. */
export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code;
  const base = code && ERROR_LABELS[code] ? ERROR_LABELS[code] : e instanceof Error ? e.message : String(e);
  // 400 VALIDATION details · MONTH_CLOSED dates · 409 rows 를 앞 3개만 덧붙인다.
  const d = (e as { data?: Record<string, unknown> })?.data;
  const list = [d?.details, d?.dates, d?.rows].find(Array.isArray) as unknown[] | undefined;
  if (!list?.length) return base;
  const item = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x));
  return `${base} (${list.slice(0, 3).map(item).join(', ')}${list.length > 3 ? ` 외 ${list.length - 3}건` : ''})`;
}

export interface MatrixCell {
  shift: string | null;
  status: string;
  /** 경고 코드. 비어 있으면 Worker 가 생략한다. */
  flags?: string[];
}

/** 칸 글자: 연(휴가) > !(누락·결근) > 근무표(주/야/휴) > 빈칸. */
export function cellLabel(c: MatrixCell | undefined): string {
  if (!c) return '';
  if (c.status === 'leave') return '연';
  if (c.status === 'missing' || c.status === 'absent') return '!';
  if (c.shift === 'DAY') return '주';
  if (c.shift === 'NIGHT') return '야';
  if (c.shift === 'DAY_STD') return '통';
  if (c.shift === 'REST' || c.shift === 'WEEKLY_HOLIDAY' || c.status === 'off') return '휴';
  return c.shift ? c.shift.slice(0, 1) : '';
}

/** 칸의 경고 코드 = matrix flags. flags 가 없을 때만 누락·결근 상태로 대신한다. */
export function cellWarnings(c: MatrixCell | undefined): string[] {
  if (!c) return [];
  if (c.flags?.length) return c.flags;
  return c.status === 'missing' || c.status === 'absent' ? [c.status] : [];
}

/** 'YYYY-MM' 을 n 달 이동. */
export function shiftYm(ym: string, n: number): string {
  const m = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n;
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
}

/** 분 → 'h:mm'. */
export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
