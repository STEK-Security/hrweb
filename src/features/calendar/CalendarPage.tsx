/**
 * HR캘린더(T11.3, DB 영속) — hr_events CRUD + employees 기반 자동 이벤트
 * (입사일·퇴사(예정)일·수습평가일 +30/+55·생일, 재직자만) 를 원본 HRCalendarView UI로 표시한다.
 * 원본 UI(HRCalendarView/AddScheduleModal/EditScheduleModal)는 그대로 재사용하고,
 * 이 페이지는 DB 조회 결과를 원본이 기대하는 prop 형태로 매핑 + 콜백을 DB 쓰기에 배선한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { HRCalendarView } from '../../components/HRCalendarView';
import { AddScheduleModal } from '../../components/AddScheduleModal';
import type { CalendarEventItem } from '../../types';
import {
  listEmployees,
  listHrEvents,
  createHrEvent,
  updateHrEvent,
  deleteHrEvent,
  type Employee,
  type HrEvent,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';

const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** hr_events(DB) 행 → 원본 컴포넌트가 쓰는 CalendarEventItem. */
function toCalendarEventItem(ev: HrEvent): CalendarEventItem {
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

/**
 * 재직자 기준 자동 이벤트: 입사일/퇴사(예정)일/1차·최종 수습평가일/생일.
 * 표시 중인 연/월(viewYear/viewMonth)에 해당하는 것만 생성해 우측 패널 카운트가
 * 전 연도로 합산되는 것을 방지한다.
 */
function buildAutoEvents(employees: Employee[], viewYear: number, viewMonth: number): CalendarEventItem[] {
  const out: CalendarEventItem[] = [];
  const monthPrefix = `${viewYear}-${pad2(viewMonth)}`;

  const push = (id: string, date: string, title: string, category: CalendarEventItem['category']) => {
    if (!date.startsWith(monthPrefix)) return; // 표시 중인 월만 생성
    out.push({ id, title, date, startDate: date, endDate: date, category, source: '인사DB연동' });
  };

  for (const e of employees) {
    if (!e._activeNow) continue;
    if (e._hireDate) push(`hire-${e['id']}`, e._hireDate, `${e._name} 입사일`, '입사자');
    if (e._quitDate) push(`quit-${e['id']}`, e._quitDate, `${e._name} 퇴사(예정)일`, '퇴사자');
    if (e._prob1st) push(`p1-${e['id']}`, e._prob1st, `${e._name} 1차 수습평가`, '1차 수습평가');
    if (e._probFinal) push(`pf-${e['id']}`, e._probFinal, `${e._name} 최종 수습평가`, '최종 수습평가');

    const birth = e['생년월일'] ? new Date(String(e['생년월일'])) : null;
    if (birth && !isNaN(birth.getTime())) {
      push(`birth-${e['id']}-${viewYear}`, iso(viewYear, birth.getMonth(), birth.getDate()), `${e._name} 생일`, '전사HR');
    }
  }
  return out;
}

export function CalendarPage() {
  const today = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const reload = () => {
    Promise.all([listEmployees(), listHrEvents()]).then(([emps, evs]) => {
      setEmployees(emps);
      setEvents(evs);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const calendarEvents = useMemo(
    () => [...events.map(toCalendarEventItem), ...buildAutoEvents(employees, viewYear, viewMonth)],
    [events, employees, viewYear, viewMonth]
  );

  const handleAddEvent = (item: CalendarEventItem) => {
    void (async () => {
      const id = await createHrEvent({
        title: item.title,
        event_date: item.startDate || item.date,
        end_date: item.endDate && item.endDate !== (item.startDate || item.date) ? item.endDate : null,
        category: item.category,
        location: item.location ?? null,
        description: item.description ?? null,
      });
      if (id) {
        await logEvent('create_event', { targetId: id, targetTable: 'hr_events' });
        reload();
      }
    })();
  };

  const handleUpdateEvent = (item: CalendarEventItem) => {
    if (item.source !== '수동등록') {
      window.alert('자동 생성 일정은 수정/삭제할 수 없습니다.');
      return;
    }
    void (async () => {
      const ok = await updateHrEvent(item.id, {
        title: item.title,
        event_date: item.startDate || item.date,
        end_date: item.endDate && item.endDate !== (item.startDate || item.date) ? item.endDate : null,
        category: item.category,
        location: item.location ?? null,
        description: item.description ?? null,
      });
      if (ok) {
        await logEvent('update_event', { targetId: item.id, targetTable: 'hr_events' });
        reload();
      }
    })();
  };

  const handleDeleteEvent = (id: string) => {
    if (!events.some((ev) => ev.id === id)) {
      window.alert('자동 생성 일정은 수정/삭제할 수 없습니다.');
      return;
    }
    void (async () => {
      const ok = await deleteHrEvent(id);
      if (ok) {
        await logEvent('delete_event', { targetId: id, targetTable: 'hr_events' });
        reload();
      }
    })();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <>
      <HRCalendarView
        events={calendarEvents}
        onOpenAddSchedule={() => setAddOpen(true)}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
        onSyncDB={reload}
        onMonthChange={(y, m) => {
          setViewYear(y);
          setViewMonth(m);
        }}
      />
      <AddScheduleModal isOpen={addOpen} onClose={() => setAddOpen(false)} onAddEvent={handleAddEvent} />
    </>
  );
}
