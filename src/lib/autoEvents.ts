/**
 * employees 기반 자동일정 생성의 단일 소스. HR캘린더와 대시보드가 같은 규칙을 쓴다.
 * (이전에는 CalendarPage/DashboardPage 에 서로 다르게 2중 구현돼 있어, 퇴직자의 입·퇴사일이
 *  대시보드에는 뜨고 캘린더에는 안 뜨는 불일치가 있었다)
 *
 * 규칙(2026-08 확정):
 *  - 입사일·퇴사일: 퇴직자 포함 전원 생성(과거 이력도 조회 가능해야 한다)
 *  - 기간성 일정(1차/최종 수습평가·계약종료): 입사일 ≤ 일정일 ≤ 퇴사일 일 때만 생성
 *    → 1차 수습평가 후 퇴사한 사람의 최종평가 일정은 자동으로 생기지 않는다
 *  - 생일: 생성하지 않는다(운영 요청으로 삭제)
 *
 * 자동일정은 DB(hr_events)에 저장하지 않고 매 렌더 파생한다. 따라서 직원이 삭제(soft delete)되면
 * 해당 직원의 자동일정도 함께 사라진다 — 별도 정리 작업이 필요 없다.
 */
import type { Employee } from '../excel/derive';
import { today, localISO } from '../excel/derive';
import type { HrEvent } from './db';
import type { CalendarEventItem } from '../types';

/** 자동일정을 생성할 날짜 구간(ISO yyyy-mm-dd, 양끝 포함) */
export interface AutoEventRange {
  from: string;
  to: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 표시 중인 연/월(1-12) → 그 달 1일~말일 구간 */
export function monthRange(year: number, month: number): AutoEventRange {
  const last = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(last)}` };
}

/** 기준연도 전후 1년 구간(대시보드 우측 캘린더 패널이 쓰는 범위) */
export function yearSpanRange(year: number): AutoEventRange {
  return { from: `${year - 1}-01-01`, to: `${year + 1}-12-31` };
}

function calLocation(site: string): string {
  if (site.includes('천안')) return '천안';
  if (/미국|해외/.test(site)) return site;
  return '서울';
}

/** hr_events(DB 수동등록 일정) 행 → 화면이 쓰는 CalendarEventItem */
export function hrEventToItem(ev: HrEvent): CalendarEventItem {
  const start = ev.event_date;
  return {
    id: ev.id,
    title: ev.title,
    date: start,
    startDate: start,
    endDate: ev.end_date ?? start,
    category: (ev.category ?? '전사HR') as CalendarEventItem['category'],
    location: ev.location ?? undefined,
    source: '수동등록',
    description: ev.description ?? undefined,
  };
}

export function buildAutoEvents(
  employees: Employee[],
  range: AutoEventRange,
  /** '(예정)' 표기 판단 기준일. 기본값은 오늘(derive.ts 기준일). */
  asOf?: string
): CalendarEventItem[] {
  const nowISO = asOf ?? localISO(today());
  const out: CalendarEventItem[] = [];
  const inRange = (iso: string | null | undefined): iso is string =>
    !!iso && iso >= range.from && iso <= range.to;

  for (const e of employees) {
    const empId = String(e['id'] ?? e._id);
    const hire = e._hireDate;
    const quit = e._quitDate;
    /** 재직기간 내 판정 — 입사 전이나 퇴사 후 날짜에는 일정을 만들지 않는다 */
    const employedOn = (iso: string) => (!hire || iso >= hire) && (!quit || iso <= quit);

    const push = (
      id: string,
      date: string,
      title: string,
      category: CalendarEventItem['category'],
      description: string
    ) => {
      out.push({
        id,
        title,
        date,
        startDate: date,
        endDate: date,
        category,
        location: calLocation(e._site),
        targetPerson: e._name,
        department: e._team,
        source: '인사DB연동',
        description,
      });
    };

    // 입사일·퇴사일: 퇴직자 포함 전원
    if (inRange(hire)) push(`hire-${empId}`, hire, `${e._name} 입사`, '입사자', '신규 입사');
    if (inRange(quit)) {
      const planned = quit > nowISO;
      push(
        `quit-${empId}`,
        quit,
        `${e._name} 퇴사${planned ? '(예정)' : ''}`,
        '퇴사자',
        planned ? '퇴직 예정' : '퇴직 처리'
      );
    }

    // 기간성 일정: 재직기간 내에서만
    if (inRange(e._prob1st) && employedOn(e._prob1st)) {
      push(`p1-${empId}`, e._prob1st, `${e._name} 1차 수습평가`, '1차 수습평가', '입사일 +30일 (1차 수습평가)');
    }
    if (inRange(e._probFinal) && employedOn(e._probFinal)) {
      push(`pf-${empId}`, e._probFinal, `${e._name} 최종 수습평가`, '최종 수습평가', '입사일 +55일 (최종 수습평가)');
    }
    const contractEnd = e['계약종료일'] ? String(e['계약종료일']) : null;
    if (inRange(contractEnd) && employedOn(contractEnd)) {
      push(`contract-${empId}`, contractEnd, `${e._name} 계약 종료`, '인사일반', '계약 종료 예정');
    }

    // 생일 자동일정은 생성하지 않는다(2026-08 운영 요청으로 삭제).
  }
  return out;
}
