/** 엑셀 원본 행 → 파생 필드가 붙은 임직원 레코드 */
import { RawRow } from './parse';

export interface Derived {
  _id: string;
  _name: string;
  _retired: boolean;      // 퇴직 완료
  _pending: boolean;      // 퇴직 예정
  _activeNow: boolean;    // 기준일 현재 재직
  _age: number | null;
  _ageBand: '20대 이하' | '30대' | '40대' | '50대 이상' | '미상';
  _sex: string;
  _foreign: boolean;
  _corp: string;
  _div: string;           // 본부
  _team: string;
  _path: string[];
  _site: string;
  _emp: string;           // 고용구분
  _grade: string;         // 직급
  _title: string;         // 직책
  _edu: string;
  _hireDate: string | null;
  _quitDate: string | null;
  _hireYear: string;
  _hireMonth: number | null;
  _tenure: number | null;
  _tenureBand: string;
  _office: '사무직' | '현장직';
  _probEnd: string | null;
  /** 입사일 + 30일 = 1차 수습평가일 */
  _prob1st: string | null;
  /** 입사일 + 55일 = 최종 수습평가일 */
  _probFinal: string | null;
  _dday1st: number | null;
  _ddayFinal: number | null;
  _ddayProb: number | null;
  _ddayContract: number | null;
  _ddayVisa: number | null;
  _ddayBirth: number | null;
  _ddayAnniv: number | null;
  _toRetire: number | null;
  _rrnSex: string | null;
  _careerMonths: number;
  _payeeMatch: boolean;
  _addrMatch: boolean;
}

/** 원본 컬럼(한글 키)과 파생 필드를 함께 갖는 레코드 */
export type Employee = RawRow & Derived;

/* ---------- 기준일 ---------- */
let TODAY = new Date(new Date().toDateString());
export const today = () => TODAY;
export const setToday = (v?: string | null) => {
  const d = v ? new Date(v) : new Date(new Date().toDateString());
  if (!isNaN(d.getTime())) TODAY = new Date(d.toDateString());
};

export const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseD = (s: unknown): Date | null => {
  if (!s) return null;
  const d = new Date(String(s).replace(/[./]/g, '-'));
  return isNaN(d.getTime()) ? null : d;
};
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

/** 미래 양수 / 과거 음수 */
export const dday = (s: unknown): number | null => { const d = parseD(s); return d ? days(TODAY, d) : null; };
/** 연 반복 기념일까지 남은 일수 */
export const ddayAnnual = (s: unknown): number | null => {
  const d = parseD(s); if (!d) return null;
  let next = new Date(TODAY.getFullYear(), d.getMonth(), d.getDate());
  if (next < TODAY) next = new Date(TODAY.getFullYear() + 1, d.getMonth(), d.getDate());
  return days(TODAY, next);
};

const ageBand = (a: number | null): Derived['_ageBand'] =>
  a == null ? '미상' : a < 30 ? '20대 이하' : a < 40 ? '30대' : a < 50 ? '40대' : '50대 이상';
const tenureBand = (y: number | null) =>
  y == null ? '미상' : y < 1 ? '1년 미만' : y < 3 ? '1~3년' : y < 5 ? '3~5년' : y < 10 ? '5~10년' : '10년 이상';

export const RETIRE_AGE = 60;

/* ============================================================
   조직 규칙 (운영자 지정)
   ============================================================ */
/**
 * 생산 부문 = 생산팀 + 품질팀 + 물류팀.
 * 현장직 "하위 분류"(생산직/물류직) 전용이다 — 현장직 판정에는 더 이상 쓰지 않는다.
 */
export const PRODUCTION_RE = /생산|품질|물류/;

/**
 * 그룹웨어 직급 개편(2026-08) 기준 현장직 직급.
 * 이 직급인 사람만 현장직으로 카운트하고 나머지는 전부 사무직이다(소속명과 무관).
 * org_settings.field_grades 로 덮어쓸 수 있다(setFieldGrades) — 미설정/조회실패 시 이 기본값.
 */
export const DEFAULT_FIELD_GRADES = ['사원(기능)', '리더', '책임'];
let FIELD_GRADES = new Set(DEFAULT_FIELD_GRADES);

/** org_settings.field_grades 적용(빈 값이면 기본값으로 되돌린다) */
export const setFieldGrades = (list?: string[] | null) => {
  const cleaned = (list ?? []).map((s) => String(s).trim()).filter(Boolean);
  FIELD_GRADES = new Set(cleaned.length ? cleaned : DEFAULT_FIELD_GRADES);
};
/** 현재 적용 중인 현장직 직급 목록(표시·테스트용) */
export const fieldGrades = () => [...FIELD_GRADES];

/** 현장직 판정: 직급이 현장직 직급 목록에 있을 때만. */
const officeType = (grade: string): '사무직' | '현장직' =>
  FIELD_GRADES.has(grade.trim()) ? '현장직' : '사무직';

/** 법인·조직명 표기 통일 — '총괄' 은 TBS 로 표기한다 */
export const normalizeOrg = (v: string): string =>
  v && /^총괄$|총괄$/.test(v.trim()) ? 'TBS' : v;

/** 테스트 계정·GPRO 데이터는 집계에서 제외한다 */
const EXCLUDE_RE = /테스트|test|GPRO/i;
/**
 * 그룹웨어ID 는 로그인 아이디/메일주소라 부분일치로 보면 오탐이 난다
 * (`bluesteel`, `jtester`, `@gpro.co.kr` 도메인 등 → 멀쩡한 직원이 전 화면에서 사라진다).
 * 여기만 "테스트 계정 접두사"로 좁힌다. 나머지 필드는 사람이 적는 값이라 기존 부분일치 유지.
 */
const EXCLUDE_ID_RE = /^(테스트|test)/i;
const EXCLUDE_FIELDS = ['성명', '법인', '소속', '전체소속명', '직책', '직급', '영문성명', '닉네임'];
export function isExcludedRow(raw: RawRow): boolean {
  if (EXCLUDE_ID_RE.test(String(raw['그룹웨어ID'] ?? '').trim())) return true;
  return EXCLUDE_FIELDS.some((k) => EXCLUDE_RE.test(String(raw[k] ?? '')));
}

/** 집계 대상에서 뺄 조직명 (부서별 분포 등) */
export const isRealOrg = (name: string): boolean =>
  !!name && !/^미지정$/.test(name) && !EXCLUDE_RE.test(name);

export function derive(raw: RawRow, i: number): Employee {
  const r = { ...raw } as Employee;
  const g = (k: string) => raw[k] ?? null;
  const hire = parseD(g('입사일')) || parseD(g('그룹입사일'));
  const quit = parseD(g('퇴직일'));
  const birth = parseD(g('생년월일'));

  r._id = String(g('사번') || g('그룹사원번호') || `R${i + 1}`);
  r._name = g('성명') || '(무명)';
  r._retired = !!quit && quit <= TODAY;
  r._pending = !!quit && quit > TODAY;
  // 기준일 현재 재직 = 입사했고(입사일 ≤ 기준일) 아직 퇴직 전(퇴직일 > 기준일).
  // 입사일 조건이 없으면 과거 기준일 스냅샷에서 미입사자가 재직으로 집계된다.
  r._activeNow = (!hire || hire <= TODAY) && (!quit || quit > TODAY);
  r._age = g('나이(만)') != null ? Number(g('나이(만)')) : birth ? Math.floor(days(birth, TODAY) / 365.25) : null;
  r._ageBand = ageBand(r._age);
  r._sex = g('성별') || '미상';
  r._foreign = (g('내/외국인') || '') === '외국인';

  const path = (g('전체소속명') || '').split('>').map((s) => s.trim()).filter(Boolean);
  r._path = path;
  r._corp = normalizeOrg(path[0] || g('법인') || '미지정');
  r._div = normalizeOrg(path[1] || '미지정');
  r._team = normalizeOrg(path[path.length - 1] || g('소속') || '미지정');
  r._path = path.map(normalizeOrg);
  r._site = g('근무지') || '미지정';
  r._emp = g('고용구분') || '미지정';
  r._grade = g('직급') || '미지정';
  r._title = g('직책') || '미지정';
  r._edu = g('학력') || '미상';
  r._office = officeType(r._grade);

  r._hireDate = hire ? localISO(hire) : null;
  r._quitDate = quit ? localISO(quit) : null;
  r._hireYear = hire ? String(hire.getFullYear()) : '미상';
  r._hireMonth = hire ? hire.getMonth() + 1 : null;
  r._tenure = hire ? Number((days(hire, quit && quit < TODAY ? quit : TODAY) / 365.25).toFixed(1)) : null;
  r._tenureBand = tenureBand(r._tenure);

  r._probEnd = g('수습종료일');
  const addDays = (base: Date | null, n: number) => {
    if (!base) return null;
    const d = new Date(base); d.setDate(d.getDate() + n); return localISO(d);
  };
  r._prob1st = addDays(hire, 30);      // 입사일 +30일 = 1차 수습평가일
  r._probFinal = addDays(hire, 55);    // 입사일 +55일 = 최종 수습평가일
  r._dday1st = dday(r._prob1st);
  r._ddayFinal = dday(r._probFinal);
  r._ddayProb = dday(r._probEnd);
  r._ddayContract = dday(g('계약종료일'));
  r._ddayVisa = dday(g('체류종료일'));
  r._ddayBirth = ddayAnnual(g('생년월일'));
  r._ddayAnniv = r._hireDate ? ddayAnnual(r._hireDate) : null;
  r._toRetire = r._age != null ? RETIRE_AGE - r._age : null;

  const code = (g('주민번호') || '').split('-')[1]?.[0];
  r._rrnSex = code ? (['1', '3', '5', '7', '9'].includes(code) ? '남' : '여') : null;
  r._careerMonths = Number(g('인정경력(년)') || 0) * 12 + Number(g('인정경력(월)') || 0);
  r._payeeMatch = !g('급여계좌(예금주)') || g('급여계좌(예금주)') === r._name;
  r._addrMatch = (g('현 주소(주소)') || '') === (g('등본주소(주소)') || '');
  return r;
}

/** 테스트·GPRO 행을 제외하고 파생필드를 붙인다 */
export function deriveAll(rows: RawRow[]): Employee[] {
  return rows.filter((r) => !isExcludedRow(r)).map(derive);
}
/**
 * 기준일(asOf)을 적용해 파생필드를 다시 계산한다. 전역 기준일은 호출 전 값으로 복원된다.
 * Employee = RawRow & Derived 이므로 이미 파생된 배열을 그대로 넘겨도 된다(추가 DB 조회 불필요).
 */
export function deriveAllAsOf(rows: RawRow[], asOf: string): Employee[] {
  const prev = localISO(today());
  setToday(asOf);
  try {
    return deriveAll(rows);
  } finally {
    setToday(prev);
  }
}

/** 제외된 행 수 */
export const countExcluded = (rows: RawRow[]) => rows.filter(isExcludedRow).length;

/** 팀 리더 직책 판정 */
export const LEADER_RE = /팀장|부장|매니저|본부장|실장|센터장|반장|파트장/;
export const isLeader = (r: Employee) => LEADER_RE.test(r._title || '');
