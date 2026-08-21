/**
 * HR캘린더(T11.3, DB 영속) — hr_events/hr_checklists CRUD + employees 기반 자동 이벤트
 * (입사일·퇴사(예정)일·수습평가일 +30/+55·생일, 재직자만) 를 원본 HRCalendarView UI로 표시한다.
 * 원본 UI(HRCalendarView/AddScheduleModal/EditScheduleModal)는 그대로 재사용하고,
 * 이 페이지는 DB 조회 결과를 원본이 기대하는 prop 형태로 매핑 + 콜백을 DB 쓰기에 배선한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { HRCalendarView } from '../../components/HRCalendarView';
import { AddScheduleModal } from '../../components/AddScheduleModal';
import type { CalendarEventItem, DailyChecklistItem } from '../../types';
import {
  listEmployees,
  listHrEvents,
  createHrEvent,
  updateHrEvent,
  deleteHrEvent,
  listHrChecklists,
  createHrChecklist,
  updateHrChecklist,
  type Employee,
  type HrEvent,
  type HrChecklistItem,
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

/** 재직자 기준 자동 이벤트: 입사일/퇴사(예정)일/1차·최종 수습평가일/생일(±1년, 표시년도로 치환). */
function buildAutoEvents(employees: Employee[]): CalendarEventItem[] {
  const out: CalendarEventItem[] = [];
  const thisYear = new Date().getFullYear();
  const push = (id: string, date: string, title: string) => {
    out.push({ id, title, date, startDate: date, endDate: date, category: '자동', source: '인사DB연동' });
  };

  for (const e of employees) {
    if (!e._activeNow) continue;
    if (e._hireDate) push(`hire-${e['id']}`, e._hireDate, `${e._name} 입사일`);
    if (e._quitDate) push(`quit-${e['id']}`, e._quitDate, `${e._name} 퇴사(예정)일`);
    if (e._prob1st) push(`p1-${e['id']}`, e._prob1st, `${e._name} 1차 수습평가`);
    if (e._probFinal) push(`pf-${e['id']}`, e._probFinal, `${e._name} 최종 수습평가`);

    const birth = e['생년월일'] ? new Date(String(e['생년월일'])) : null;
    if (birth && !isNaN(birth.getTime())) {
      // ponytail: 생일은 이번 해 ±1년만 노출, 더 먼 과거/미래 탐색이 필요해지면 범위 확장
      for (const y of [thisYear - 1, thisYear, thisYear + 1]) {
        push(`birth-${e['id']}-${y}`, iso(y, birth.getMonth(), birth.getDate()), `${e._name} 생일`);
      }
    }
  }
  return out;
}

/** hr_checklists(DB) 행 → 원본 컴포넌트가 쓰는 DailyChecklistItem. */
function toDailyChecklistItem(c: HrChecklistItem): DailyChecklistItem {
  return {
    id: c.id,
    title: c.title,
    category: '일일업무',
    dueDate: c.due_date ?? '',
    completed: c.completed,
    priority: '보통',
    assignee: c.assignee ?? '',
  };
}

export function CalendarPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [checklist, setChecklist] = useState<HrChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const reload = () => {
    Promise.all([listEmployees(), listHrEvents(), listHrChecklists()]).then(([emps, evs, cl]) => {
      setEmployees(emps);
      setEvents(evs);
      setChecklist(cl);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const calendarEvents = useMemo(
    () => [...events.map(toCalendarEventItem), ...buildAutoEvents(employees)],
    [events, employees]
  );
  const calendarChecklists = useMemo(() => checklist.map(toDailyChecklistItem), [checklist]);

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
    if (item.source !== '수동등록') return; // 자동 생성 일정은 DB 행이 없어 수정 불가
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
    if (!events.some((ev) => ev.id === id)) return; // 자동 생성 일정 등 DB 미존재 항목 무시
    void (async () => {
      const ok = await deleteHrEvent(id);
      if (ok) {
        await logEvent('delete_event', { targetId: id, targetTable: 'hr_events' });
        reload();
      }
    })();
  };

  const handleToggleChecklist = (id: string) => {
    const item = checklist.find((c) => c.id === id);
    if (!item) return;
    void (async () => {
      const ok = await updateHrChecklist(id, { completed: !item.completed });
      if (ok) {
        await logEvent('update_checklist', { targetId: id, targetTable: 'hr_checklists', meta: { completed: !item.completed } });
        reload();
      }
    })();
  };

  const handleAddChecklist = (item: DailyChecklistItem) => {
    void (async () => {
      const id = await createHrChecklist({
        title: item.title,
        category: item.category ?? null,
        due_date: item.dueDate || null,
        completed: item.completed,
        assignee: item.assignee || null,
      });
      if (id) {
        await logEvent('create_checklist', { targetId: id, targetTable: 'hr_checklists' });
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
        checklists={calendarChecklists}
        onOpenAddSchedule={() => setAddOpen(true)}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
        onToggleChecklist={handleToggleChecklist}
        onAddChecklist={handleAddChecklist}
        onSyncDB={reload}
      />
      <AddScheduleModal isOpen={addOpen} onClose={() => setAddOpen(false)} onAddEvent={handleAddEvent} />
    </>
  );
}
