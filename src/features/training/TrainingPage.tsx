/**
 * 교육관리(T11.9) — 원본 TrainingManagement UI(hr-app.html) 재사용, training_courses/training_records DB 배선.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
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
  enqueueMail,
  listMailQueue,
  getSensitiveMasked,
  type Employee,
  type TrainingCourse,
  type TrainingRecord,
  type MailQueueRow,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';
import { TrainingManagement } from '../../components/TrainingManagement';
import type { TrainingCourseItem, TrainingParticipant } from '../../types';

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

// 원본 TrainingManagement props 형태로 매핑
function mapCourseToItem(c: TrainingCourse, recs: TrainingRecord[]): TrainingCourseItem {
  const targetCount = c.target_count ?? recs.length;
  const completedCount = recs.filter((r) => r.status === '수료').length;
  return {
    id: c.id,
    title: c.title,
    category: (c.category as TrainingCourseItem['category']) ?? CATEGORY_OPTIONS[1] as TrainingCourseItem['category'],
    targetCount,
    completedCount,
    completionRate: targetCount > 0 ? Math.round((completedCount / targetCount) * 1000) / 10 : 0,
    startDate: c.start_date ?? '',
    endDate: c.end_date ?? '',
    instructor: c.instructor ?? '',
    status: (c.status as TrainingCourseItem['status']) ?? STATUS_OPTIONS[1] as TrainingCourseItem['status'],
    mandatory: c.mandatory,
  };
}

function mapRecordToParticipant(r: TrainingRecord, course: TrainingCourse | undefined, emp: Employee | undefined): TrainingParticipant {
  return {
    id: r.id,
    name: emp?._name ?? '(삭제된 직원)',
    department: emp?._div || emp?._team || '-',
    position: emp?._grade || '-',
    courseTitle: course?.title ?? '-',
    status: r.status,
    completedDate: r.completed_date ?? undefined,
    score: r.score ?? undefined,
  };
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

  const [notifying, setNotifying] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null);

  const [mailQueueOpen, setMailQueueOpen] = useState(false);
  const [mailQueueRows, setMailQueueRows] = useState<MailQueueRow[]>([]);
  const [mailQueueLoading, setMailQueueLoading] = useState(false);

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

  const courseMap = useMemo(() => {
    const m = new Map<string, TrainingCourse>();
    for (const c of courses) m.set(c.id, c);
    return m;
  }, [courses]);

  const recordsByCourse = useMemo(() => {
    const m = new Map<string, TrainingRecord[]>();
    for (const r of records) {
      if (!m.has(r.course_id)) m.set(r.course_id, []);
      m.get(r.course_id)!.push(r);
    }
    return m;
  }, [records]);

  const courseItems = useMemo(
    () => courses.map((c) => mapCourseToItem(c, recordsByCourse.get(c.id) ?? [])),
    [courses, recordsByCourse]
  );
  const participantItems = useMemo(
    () => records.map((r) => mapRecordToParticipant(r, courseMap.get(r.course_id), empMap.get(r.employee_id))),
    [records, courseMap, empMap]
  );

  // 과정 CRUD
  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm(courseEmptyForm());
    setError(null);
    setCourseFormOpen(true);
  };
  const openEditCourse = (courseId: string) => {
    const c = courseMap.get(courseId);
    if (!c) return;
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
  const handleDeleteCourse = async (courseId: string) => {
    const c = courseMap.get(courseId);
    if (!c) return;
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
  const openCreateRecordForCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    openCreateRecord();
  };
  const openEditRecord = (recordId: string) => {
    const r = records.find((x) => x.id === recordId);
    if (!r) return;
    setEditingRecord(r);
    setRecordForm({ employee_id: r.employee_id, status: r.status, completed_date: r.completed_date ?? '', score: r.score != null ? String(r.score) : '' });
    setError(null);
    setRecordFormOpen(true);
  };
  const handleSubmitRecord = async () => {
    setError(null);
    const courseId = editingRecord ? editingRecord.course_id : selectedCourseId;
    if (!recordForm.employee_id || !courseId) {
      setError('직원을 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        course_id: courseId,
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
  const handleDeleteRecord = async (recordId: string) => {
    const r = records.find((x) => x.id === recordId);
    if (!r) return;
    if (!window.confirm('이 수료현황을 삭제할까요?')) return;
    const ok = await deleteTrainingRecord(r.id);
    if (!ok) return;
    await logEvent('delete_training_record', { targetId: r.id, targetTable: 'training_records' });
    reload();
  };

  // 미수료자 독려 알림 -> 메일 큐 적재
  const handleNotifyUncompleted = async (uncompleted: TrainingParticipant[]) => {
    if (notifying) return;
    setNotifying(true);
    try {
      const targets = uncompleted
        .map((p) => records.find((r) => r.id === p.id))
        .filter((r): r is TrainingRecord => !!r);
      if (targets.length === 0) {
        setNotifyMessage('미수료 대상자가 없습니다.');
        return;
      }
      const rows = (
        await Promise.all(
          targets.map(async (r) => {
            const emp = empMap.get(r.employee_id);
            if (!emp) return null;
            const masked = await getSensitiveMasked(r.employee_id);
            const email = masked?.email as string | undefined;
            if (!email) return null;
            const course = courseMap.get(r.course_id);
            return {
              toEmail: email,
              toName: emp._name,
              subject: '[교육] 미수료 과정 이수 독려',
              body: `${emp._name}님, "${course?.title ?? '-'}" 과정이 미수료 상태입니다. 빠른 시일 내 이수를 완료해 주세요.`,
              category: 'training_reminder',
              relatedTable: 'training_records',
              relatedId: r.id,
            };
          })
        )
      ).filter((r): r is NonNullable<typeof r> => r != null);
      const skipped = targets.length - rows.length;
      if (rows.length === 0) {
        setNotifyMessage('이메일이 등록된 미수료 대상자가 없습니다.');
        return;
      }
      const ok = await enqueueMail(rows);
      if (!ok) {
        setNotifyMessage('발송 대기열 등록에 실패했습니다.');
        return;
      }
      await logEvent('export', { targetTable: 'training_records', meta: { kind: 'mail_enqueue', count: rows.length, skipped } });
      setNotifyMessage(`${rows.length}건 발송 대기열 등록${skipped > 0 ? ` (이메일 없음 ${skipped}건 제외)` : ''} (실제 발송은 n8n)`);
    } finally {
      setNotifying(false);
      setTimeout(() => setNotifyMessage(null), 4000);
    }
  };

  const openMailQueue = async () => {
    setMailQueueOpen(true);
    setMailQueueLoading(true);
    setMailQueueRows(await listMailQueue(20));
    setMailQueueLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <>
      {notifyMessage && (
        <div className="fixed top-4 right-4 z-[60] bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-bold max-w-sm">
          {notifyMessage}
        </div>
      )}

      <TrainingManagement
        courses={courseItems}
        records={participantItems}
        onCreateCourse={openCreateCourse}
        onEditCourse={openEditCourse}
        onDeleteCourse={handleDeleteCourse}
        onCreateRecordForCourse={openCreateRecordForCourse}
        onEditRecord={openEditRecord}
        onDeleteRecord={handleDeleteRecord}
        onNotifyUncompleted={handleNotifyUncompleted}
        onOpenMailQueue={openMailQueue}
      />

      {mailQueueOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">메일 발송 대기열 (최근 20건)</h3>
              <button type="button" onClick={() => setMailQueueOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {mailQueueLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> 불러오는 중...
              </div>
            ) : mailQueueRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">대기열이 비어 있습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3 font-bold">수신자</th>
                      <th className="py-2 pr-3 font-bold">제목</th>
                      <th className="py-2 pr-3 font-bold">상태</th>
                      <th className="py-2 pr-3 font-bold">등록일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mailQueueRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{row.to_email}</td>
                        <td className="py-2 pr-3 text-slate-700">{row.subject}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.status === '발송완료'
                                ? 'bg-emerald-100 text-emerald-700'
                                : row.status === '실패'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-500">{new Date(row.created_at).toLocaleString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
                <label className="block font-bold text-slate-700 mb-1">교육 과정</label>
                <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">
                  {courseMap.get(editingRecord ? editingRecord.course_id : selectedCourseId ?? '')?.title ?? '-'}
                </div>
              </div>
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
    </>
  );
}
