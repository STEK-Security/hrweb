/**
 * 교육관리(T11.9) — training_courses 목록(+CRUD) 및 선택 과정의 수료현황 도넛 + training_records CRUD.
 */
import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GraduationCap, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import {
  listEmployees,
  listTrainingCourses,
  createTrainingCourse,
  updateTrainingCourse,
  deleteTrainingCourse,
  listTrainingRecords,
  createTrainingRecord,
  updateTrainingRecord,
  deleteTrainingRecord,
  type Employee,
  type TrainingCourse,
  type TrainingRecord,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';

const STATUS_COLOR: Record<TrainingRecord['status'], string> = { 수료: '#10b981', 진행중: '#3b82f6', 미수료: '#f43f5e' };
const RECORD_STATUS: TrainingRecord['status'][] = ['진행중', '수료', '미수료'];
const CATEGORY_OPTIONS = ['법정의무교육', '직무전문교육', '리더십교육', '신규입사자OJT'];
const STATUS_OPTIONS = ['모집중', '진행중', '마감', '상시'];

function courseEmptyForm(): CourseForm {
  return { title: '', category: CATEGORY_OPTIONS[0], target_count: '', start_date: '', end_date: '', instructor: '', status: STATUS_OPTIONS[0], mandatory: false };
}
interface CourseForm {
  title: string;
  category: string;
  target_count: string;
  start_date: string;
  end_date: string;
  instructor: string;
  status: string;
  mandatory: boolean;
}

export function TrainingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(courseEmptyForm());

  const [recordFormOpen, setRecordFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [recordForm, setRecordForm] = useState({ employee_id: '', status: '진행중' as TrainingRecord['status'], completed_date: '', score: '' });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([listEmployees(), listTrainingCourses(), listTrainingRecords()]).then(([emps, cs, recs]) => {
      setEmployees(emps);
      setCourses(cs);
      setRecords(recs);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e['id'] as string, e);
    return m;
  }, [employees]);

  const recordsByCourse = useMemo(() => {
    const m = new Map<string, TrainingRecord[]>();
    for (const r of records) {
      if (!m.has(r.course_id)) m.set(r.course_id, []);
      m.get(r.course_id)!.push(r);
    }
    return m;
  }, [records]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;
  const selectedRecords = selectedCourseId ? recordsByCourse.get(selectedCourseId) ?? [] : [];
  const donutData = useMemo(() => {
    const counts: Record<string, number> = { 수료: 0, 진행중: 0, 미수료: 0 };
    for (const r of selectedRecords) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: STATUS_COLOR[name as TrainingRecord['status']] }));
  }, [selectedRecords]);

  // 과정 CRUD
  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm(courseEmptyForm());
    setError(null);
    setCourseFormOpen(true);
  };
  const openEditCourse = (c: TrainingCourse) => {
    setEditingCourse(c);
    setCourseForm({
      title: c.title,
      category: c.category ?? CATEGORY_OPTIONS[0],
      target_count: c.target_count != null ? String(c.target_count) : '',
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      instructor: c.instructor ?? '',
      status: c.status ?? STATUS_OPTIONS[0],
      mandatory: c.mandatory,
    });
    setError(null);
    setCourseFormOpen(true);
  };
  const handleSubmitCourse = async () => {
    setError(null);
    if (!courseForm.title.trim()) {
      setError('과정명은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        title: courseForm.title.trim(),
        category: courseForm.category || null,
        target_count: courseForm.target_count ? Number(courseForm.target_count) : null,
        start_date: courseForm.start_date || null,
        end_date: courseForm.end_date || null,
        instructor: courseForm.instructor.trim() || null,
        status: courseForm.status || null,
        mandatory: courseForm.mandatory,
      };
      let id: string | null;
      if (editingCourse) {
        const ok = await updateTrainingCourse(editingCourse.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
        id = editingCourse.id;
      } else {
        id = await createTrainingCourse(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }
      await logEvent(editingCourse ? 'update_training_course' : 'create_training_course', { targetId: id ?? undefined, targetTable: 'training_courses' });
      setCourseFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteCourse = async (c: TrainingCourse) => {
    if (!window.confirm(`"${c.title}" 과정을 삭제할까요? (수료현황도 함께 삭제됩니다)`)) return;
    const ok = await deleteTrainingCourse(c.id);
    if (!ok) return;
    await logEvent('delete_training_course', { targetId: c.id, targetTable: 'training_courses' });
    if (selectedCourseId === c.id) setSelectedCourseId(null);
    reload();
  };

  // 수료현황 CRUD
  const openCreateRecord = () => {
    setEditingRecord(null);
    setRecordForm({ employee_id: '', status: '진행중', completed_date: '', score: '' });
    setError(null);
    setRecordFormOpen(true);
  };
  const openEditRecord = (r: TrainingRecord) => {
    setEditingRecord(r);
    setRecordForm({ employee_id: r.employee_id, status: r.status, completed_date: r.completed_date ?? '', score: r.score != null ? String(r.score) : '' });
    setError(null);
    setRecordFormOpen(true);
  };
  const handleSubmitRecord = async () => {
    setError(null);
    if (!recordForm.employee_id || !selectedCourseId) {
      setError('직원을 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        course_id: selectedCourseId,
        employee_id: recordForm.employee_id,
        status: recordForm.status,
        completed_date: recordForm.completed_date || null,
        score: recordForm.score ? Number(recordForm.score) : null,
      };
      let id: string | null;
      if (editingRecord) {
        const ok = await updateTrainingRecord(editingRecord.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
        id = editingRecord.id;
      } else {
        id = await createTrainingRecord(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }
      await logEvent(editingRecord ? 'update_training_record' : 'create_training_record', { targetId: id ?? undefined, targetTable: 'training_records' });
      setRecordFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteRecord = async (r: TrainingRecord) => {
    if (!window.confirm('이 수료현황을 삭제할까요?')) return;
    const ok = await deleteTrainingRecord(r.id);
    if (!ok) return;
    await logEvent('delete_training_record', { targetId: r.id, targetTable: 'training_records' });
    reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-blue-600" />
        교육 관리
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">교육 과정 ({courses.length})</h3>
            <button
              type="button"
              onClick={openCreateCourse}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              과정 등록
            </button>
          </div>
          <div className="overflow-x-auto max-h-[calc(100vh-380px)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">과정명</th>
                  <th className="px-3 py-2.5">분류</th>
                  <th className="px-3 py-2.5">기간</th>
                  <th className="px-3 py-2.5">강사</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">수료</th>
                  <th className="px-3 py-2.5">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">등록된 과정이 없습니다.</td>
                  </tr>
                ) : (
                  courses.map((c) => {
                    const recs = recordsByCourse.get(c.id) ?? [];
                    const done = recs.filter((r) => r.status === '수료').length;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCourseId(c.id)}
                        className={`cursor-pointer transition-colors ${selectedCourseId === c.id ? 'bg-blue-50' : 'hover:bg-blue-50/40'}`}
                      >
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {c.title}
                          {c.mandatory && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">필수</span>}
                        </td>
                        <td className="px-3 py-2.5">{c.category ?? '-'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{c.start_date ?? '-'} ~ {c.end_date ?? '-'}</td>
                        <td className="px-3 py-2.5">{c.instructor ?? '-'}</td>
                        <td className="px-3 py-2.5">{c.status ?? '-'}</td>
                        <td className="px-3 py-2.5">{done}/{recs.length}{c.target_count ? ` (대상 ${c.target_count})` : ''}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); openEditCourse(c); }} aria-label="수정" className="p-1 rounded text-blue-600 hover:bg-blue-50">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c); }} aria-label="삭제" className="p-1 rounded text-rose-600 hover:bg-rose-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">{selectedCourse ? `${selectedCourse.title} 수료현황` : '과정을 선택하세요'}</h3>
            {!selectedCourse ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400">좌측에서 과정을 클릭하세요.</div>
            ) : donutData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400">수료현황 데이터가 없습니다.</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false} data={donutData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={3}>
                      {donutData.map((d, i) => (
                        <Cell key={`c-${i}`} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [`${v}명`, n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {selectedCourse && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">수료자 명단</h3>
                <button type="button" onClick={openCreateRecord} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" />
                  등록
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                {selectedRecords.length === 0 ? (
                  <p className="px-4 py-6 text-center text-slate-400">등록된 수료현황이 없습니다.</p>
                ) : (
                  selectedRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-2">
                      <div>
                        <span className="font-bold text-slate-900">{empMap.get(r.employee_id)?._name ?? '(삭제된 직원)'}</span>{' '}
                        <span className="text-slate-500">{r.status}{r.score != null ? ` · ${r.score}점` : ''}{r.completed_date ? ` · ${r.completed_date}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEditRecord(r)} aria-label="수정" className="p-1 rounded text-blue-600 hover:bg-blue-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteRecord(r)} aria-label="삭제" className="p-1 rounded text-rose-600 hover:bg-rose-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {courseFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{editingCourse ? '과정 수정' : '과정 등록'}</h3>
              <button type="button" onClick={() => setCourseFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmitCourse(); }} className="space-y-3 text-xs">
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">과정명 *</label>
                <input type="text" value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">분류</label>
                  <select value={courseForm.category} onChange={(e) => setCourseForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">상태</label>
                  <select value={courseForm.status} onChange={(e) => setCourseForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">대상인원</label>
                  <input type="number" min={0} value={courseForm.target_count} onChange={(e) => setCourseForm((f) => ({ ...f, target_count: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">강사</label>
                  <input type="text" value={courseForm.instructor} onChange={(e) => setCourseForm((f) => ({ ...f, instructor: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">시작일</label>
                  <input type="date" value={courseForm.start_date} onChange={(e) => setCourseForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">종료일</label>
                  <input type="date" value={courseForm.end_date} onChange={(e) => setCourseForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input id="mandatory" type="checkbox" checked={courseForm.mandatory} onChange={(e) => setCourseForm((f) => ({ ...f, mandatory: e.target.checked }))} className="w-3.5 h-3.5" />
                  <label htmlFor="mandatory" className="font-bold text-slate-700">법정의무/필수 교육</label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setCourseFormOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recordFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{editingRecord ? '수료현황 수정' : '수료현황 등록'}</h3>
              <button type="button" onClick={() => setRecordFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmitRecord(); }} className="space-y-3 text-xs">
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">대상 직원 *</label>
                {editingRecord ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">{empMap.get(recordForm.employee_id)?._name ?? recordForm.employee_id}</div>
                ) : (
                  <EmployeePicker employees={employees} value={recordForm.employee_id || null} onChange={(id) => setRecordForm((f) => ({ ...f, employee_id: id }))} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">상태</label>
                  <select value={recordForm.status} onChange={(e) => setRecordForm((f) => ({ ...f, status: e.target.value as TrainingRecord['status'] }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {RECORD_STATUS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">점수</label>
                  <input type="number" min={0} max={100} value={recordForm.score} onChange={(e) => setRecordForm((f) => ({ ...f, score: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">수료일</label>
                  <input type="date" value={recordForm.completed_date} onChange={(e) => setRecordForm((f) => ({ ...f, completed_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setRecordFormOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors">취소</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
