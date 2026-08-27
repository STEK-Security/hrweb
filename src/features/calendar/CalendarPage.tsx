/**
 * HR캘린더(T11.3, DB 영속) — hr_events CRUD + employees 기반 자동 이벤트를
 * 원본 HRCalendarView UI로 표시한다.
 * 자동 이벤트 생성 규칙은 src/lib/autoEvents.ts 가 단독으로 갖는다(대시보드와 공유).
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
import { buildAutoEvents, hrEventToItem, monthRange } from '../../lib/autoEvents';
import { logEvent } from '../../lib/audit';

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
    () => [...events.map(hrEventToItem), ...buildAutoEvents(employees, monthRange(viewYear, viewMonth))],
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
