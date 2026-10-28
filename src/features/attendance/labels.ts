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
  // 아래는 matrix 칸 상태에서 끌어낸 경고(cellWarnings)
  missing: '출퇴근 누락',
  late: '지각',
  early: '조퇴',
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
};

/** AttendanceError·기타 오류를 화면 문구로. */
export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code && ERROR_LABELS[code]) return ERROR_LABELS[code];
  return e instanceof Error ? e.message : String(e);
}

export interface MatrixCell {
  shift: string | null;
  status: string;
  /** Worker matrix 는 아직 flags 를 주지 않는다 — 주면 그대로 쓴다. */
  flags?: string[];
}

/** 칸 글자: 연(휴가) > !(누락·결근) > 근무표(주/야/휴) > 빈칸. */
export function cellLabel(c: MatrixCell | undefined): string {
  if (!c) return '';
  if (c.status === 'leave') return '연';
  if (c.status === 'missing' || c.status === 'absent') return '!';
  if (c.shift === 'DAY') return '주';
  if (c.shift === 'NIGHT') return '야';
  if (c.shift === 'REST' || c.shift === 'WEEKLY_HOLIDAY' || c.status === 'off') return '휴';
  return c.shift ? c.shift.slice(0, 1) : '';
}

/**
 * 칸의 경고 코드. flags 가 오면 그것을, 없으면 상태에서 끌어낸다.
 * shortcut: matrix 에 flags 가 없어 휴게 부족·종업 이후·주52h 는 상태로 알 수 없다 — Worker matrix 가 flags 를 주면 자동으로 정확해진다.
 */
export function cellWarnings(c: MatrixCell | undefined): string[] {
  if (!c) return [];
  if (c.flags) return c.flags;
  switch (c.status) {
    case 'missing':
      return ['missing'];
    case 'absent':
      return ['absent'];
    case 'off_worked':
      return ['off_day_work'];
    case 'late':
      return ['late'];
    case 'early':
      return ['early'];
    default:
      return [];
  }
}

/** 'YYYY-MM' 을 n 달 이동. */
export function shiftYm(ym: string, n: number): string {
  const m = +ym.slice(0, 4) * 12 + (+ym.slice(5, 7) - 1) + n;
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
}

/** 분 → 'h:mm'. */
export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
