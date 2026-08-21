/**
 * HR캘린더(T11.3, DB 영속) — hr_events/hr_checklists CRUD + employees 기반 자동 이벤트
 * (입사일·퇴사(예정)일·수습평가일 +30/+55·생일, 재직자만) 를 월간 그리드에 겹쳐 표시한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, X, Loader2, CheckSquare, Square } from 'lucide-react';
import {
  listEmployees,
  listHrEvents,
  createHrEvent,
  updateHrEvent,
  deleteHrEvent,
  listHrChecklists,
  createHrChecklist,
  updateHrChecklist,
  deleteHrChecklist,
  type Employee,
  type HrEvent,
  type HrChecklistItem,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';

const CATEGORY_COLOR: Record<string, string> = {
  전사HR: 'bg-blue-100 text-blue-700',
  교육: 'bg-purple-100 text-purple-700',
  급여: 'bg-emerald-100 text-emerald-700',
  자동: 'bg-slate-100 text-slate-600',
};

interface AutoEvent {
  id: string;
  date: string; // yyyy-mm-dd
  title: string;
  category: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** 재직자 기준 자동 이벤트: 입사일/퇴사(예정)일/1차·최종 수습평가일/생일(월-일 매칭, 표시년도로 치환). */
function buildAutoEvents(employees: Employee[], year: number, month: number): AutoEvent[] {
  const out: AutoEvent[] = [];
  const inMonth = (s: string | null) => {
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  };

  for (const e of employees) {
    if (!e._activeNow) continue;
    if (inMonth(e._hireDate)) out.push({ id: `hire-${e['id']}`, date: e._hireDate as string, title: `${e._name} 입사일`, category: '자동' });
    if (e._quitDate && inMonth(e._quitDate)) out.push({ id: `quit-${e['id']}`, date: e._quitDate, title: `${e._name} 퇴사(예정)일`, category: '자동' });
    if (inMonth(e._prob1st)) out.push({ id: `p1-${e['id']}`, date: e._prob1st as string, title: `${e._name} 1차 수습평가`, category: '자동' });
    if (inMonth(e._probFinal)) out.push({ id: `pf-${e['id']}`, date: e._probFinal as string, title: `${e._name} 최종 수습평가`, category: '자동' });

    const birth = e['생년월일'] ? new Date(String(e['생년월일'])) : null;
    if (birth && !isNaN(birth.getTime()) && birth.getMonth() === month) {
      out.push({ id: `birth-${e['id']}`, date: iso(year, month, birth.getDate()), title: `${e._name} 생일`, category: '자동' });
    }
  }
  return out;
}

export function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [checklist, setChecklist] = useState<HrChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HrEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');

  const reload = () => {
    setLoading(true);
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

  const autoEvents = useMemo(() => buildAutoEvents(employees, year, month), [employees, year, month]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, { manual: HrEvent[]; auto: AutoEvent[] }>();
    const get = (d: string) => {
      if (!m.has(d)) m.set(d, { manual: [], auto: [] });
      return m.get(d)!;
    };
    for (const ev of events) {
      // event_date~end_date 범위의 날짜마다 표시
      const start = new Date(ev.event_date);
      const end = ev.end_date ? new Date(ev.end_date) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        get(iso(d.getFullYear(), d.getMonth(), d.getDate())).manual.push(ev);
      }
    }
    for (const ae of autoEvents) get(ae.date).auto.push(ae);
    return m;
  }, [events, autoEvents]);

  const monthLabel = `${year}년 ${month + 1}월`;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const goMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const openCreate = (date?: string) => {
    setEditing(null);
    setSelectedDate(date ?? null);
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (ev: HrEvent) => {
    setEditing(ev);
    setError(null);
    setFormOpen(true);
  };

  const [form, setForm] = useState({ title: '', event_date: '', end_date: '', category: '전사HR', location: '', description: '' });
  useEffect(() => {
    if (formOpen) {
      setForm(
        editing
          ? {
              title: editing.title,
              event_date: editing.event_date,
              end_date: editing.end_date ?? '',
              category: editing.category ?? '전사HR',
              location: editing.location ?? '',
              description: editing.description ?? '',
            }
          : { title: '', event_date: selectedDate ?? '', end_date: '', category: '전사HR', location: '', description: '' }
      );
    }
  }, [formOpen, editing, selectedDate]);

  const handleSubmitEvent = async () => {
    setError(null);
    if (!form.title.trim() || !form.event_date) {
      setError('제목과 날짜는 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        title: form.title.trim(),
        event_date: form.event_date,
        end_date: form.end_date || null,
        category: form.category || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
      };
      let id: string | null;
      if (editing) {
        const ok = await updateHrEvent(editing.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
        id = editing.id;
      } else {
        id = await createHrEvent(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }
      await logEvent(editing ? 'update_event' : 'create_event', { targetId: id ?? undefined, targetTable: 'hr_events' });
      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (ev: HrEvent) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    const ok = await deleteHrEvent(ev.id);
    if (!ok) return;
    await logEvent('delete_event', { targetId: ev.id, targetTable: 'hr_events' });
    reload();
  };

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    const id = await createHrChecklist({ title: newChecklistTitle.trim(), category: null, due_date: null, completed: false, assignee: null });
    if (id) {
      await logEvent('create_checklist', { targetId: id, targetTable: 'hr_checklists' });
      setNewChecklistTitle('');
      reload();
    }
  };

  const handleToggleChecklist = async (item: HrChecklistItem) => {
    const ok = await updateHrChecklist(item.id, { completed: !item.completed });
    if (ok) {
      await logEvent('update_checklist', { targetId: item.id, targetTable: 'hr_checklists', meta: { completed: !item.completed } });
      reload();
    }
  };

  const handleDeleteChecklist = async (item: HrChecklistItem) => {
    const ok = await deleteHrChecklist(item.id);
    if (ok) {
      await logEvent('delete_checklist', { targetId: item.id, targetTable: 'hr_checklists' });
      reload();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          HR캘린더
        </h2>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          일정 등록
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => goMonth(-1)} aria-label="이전 달" className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-800">{monthLabel}</span>
            <button type="button" onClick={() => goMonth(1)} aria-label="다음 달" className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 mb-1">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const dateStr = day ? iso(year, month, day) : null;
              const dayEvents = dateStr ? eventsByDate.get(dateStr) : undefined;
              return (
                <div
                  key={idx}
                  className={`min-h-[84px] rounded-lg border p-1.5 text-[11px] ${day ? 'border-slate-100 hover:border-blue-200 cursor-pointer' : 'border-transparent'}`}
                  onClick={() => dateStr && openCreate(dateStr)}
                >
                  {day && <div className="font-bold text-slate-700 mb-0.5">{day}</div>}
                  <div className="space-y-0.5">
                    {dayEvents?.manual.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ev);
                        }}
                        className={`block w-full truncate text-left px-1 py-0.5 rounded ${CATEGORY_COLOR[ev.category ?? ''] ?? 'bg-blue-50 text-blue-700'}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents?.auto.map((ae) => (
                      <div key={ae.id} className={`truncate px-1 py-0.5 rounded ${CATEGORY_COLOR['자동']}`} title={ae.title}>
                        {ae.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-800">체크리스트</h3>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="새 항목"
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button type="button" onClick={handleAddChecklist} className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {checklist.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">체크리스트가 없습니다.</p>
              ) : (
                checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-1 py-1 group">
                    <button type="button" onClick={() => handleToggleChecklist(item)} aria-label="완료 토글" className="text-slate-400 hover:text-blue-600">
                      {item.completed ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                    <span className={`flex-1 text-xs ${item.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteChecklist(item)}
                      aria-label="삭제"
                      className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{editing ? '일정 수정' : '일정 등록'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmitEvent();
              }}
              className="space-y-3 text-xs"
            >
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">시작일 *</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">종료일</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">카테고리</label>
                  <input
                    type="text"
                    placeholder="예: 전사HR"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">장소</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">설명</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                {editing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFormOpen(false);
                      void handleDeleteEvent(editing);
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    삭제
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    저장
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
