/**
 * 평가관리(T11.10) — evaluations 조회(유형탭·상태필터·진행률) + CRUD(등급·피드백 입력).
 */
import { useEffect, useMemo, useState } from 'react';
import { Award, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { listEmployees, listEvaluations, createEvaluation, updateEvaluation, deleteEvaluation, type Employee, type EvaluationRecord } from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';

const TYPE_TABS: ('전체' | EvaluationRecord['type'])[] = ['전체', '수습', '역량', '성과'];
const STATUS_OPTIONS: EvaluationRecord['status'][] = ['미작성', '진행중', '완료'];
const GRADE_OPTIONS = ['S', 'A', 'B', 'C', 'D'];

const STATUS_BADGE: Record<EvaluationRecord['status'], string> = {
  완료: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  진행중: 'bg-blue-50 text-blue-700 border-blue-200',
  미작성: 'bg-slate-100 text-slate-500 border-slate-200',
};

interface EvalForm {
  employee_id: string;
  type: EvaluationRecord['type'];
  evaluator: string;
  stage: string;
  status: EvaluationRecord['status'];
  due_date: string;
  self_score: string;
  manager_score: string;
  final_grade: string;
  feedback: string;
  submitted_date: string;
}

function emptyForm(): EvalForm {
  return { employee_id: '', type: '수습', evaluator: '', stage: '', status: '미작성', due_date: '', self_score: '', manager_score: '', final_grade: '', feedback: '', submitted_date: '' };
}

export function EvaluationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<'전체' | EvaluationRecord['type']>('전체');
  const [statusFilter, setStatusFilter] = useState<'전체' | EvaluationRecord['status']>('전체');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluationRecord | null>(null);
  const [form, setForm] = useState<EvalForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([listEmployees(), listEvaluations()]).then(([emps, evs]) => {
      setEmployees(emps);
      setEvaluations(evs);
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

  const filtered = evaluations.filter((e) => {
    if (typeTab !== '전체' && e.type !== typeTab) return false;
    if (statusFilter !== '전체' && e.status !== statusFilter) return false;
    return true;
  });
  const completedCount = filtered.filter((e) => e.status === '완료').length;
  const progress = filtered.length ? Math.round((completedCount / filtered.length) * 100) : 0;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setFormOpen(true);
  };
  const openEdit = (e: EvaluationRecord) => {
    setEditing(e);
    setForm({
      employee_id: e.employee_id,
      type: e.type,
      evaluator: e.evaluator ?? '',
      stage: e.stage ?? '',
      status: e.status,
      due_date: e.due_date ?? '',
      self_score: e.self_score != null ? String(e.self_score) : '',
      manager_score: e.manager_score != null ? String(e.manager_score) : '',
      final_grade: e.final_grade ?? '',
      feedback: e.feedback ?? '',
      submitted_date: e.submitted_date ?? '',
    });
    setError(null);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.employee_id) {
      setError('대상 직원을 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        employee_id: form.employee_id,
        type: form.type,
        evaluator: form.evaluator.trim() || null,
        stage: form.stage.trim() || null,
        status: form.status,
        due_date: form.due_date || null,
        self_score: form.self_score ? Number(form.self_score) : null,
        manager_score: form.manager_score ? Number(form.manager_score) : null,
        final_grade: form.final_grade || null,
        feedback: form.feedback.trim() || null,
        submitted_date: form.submitted_date || null,
      };
      let id: string | null;
      if (editing) {
        const ok = await updateEvaluation(editing.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
        id = editing.id;
      } else {
        id = await createEvaluation(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }
      await logEvent(editing ? 'update_evaluation' : 'create_evaluation', { targetId: id ?? undefined, targetTable: 'evaluations', meta: { type: form.type } });
      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: EvaluationRecord) => {
    if (!window.confirm('이 평가를 삭제할까요?')) return;
    const ok = await deleteEvaluation(e.id);
    if (!ok) return;
    await logEvent('delete_evaluation', { targetId: e.id, targetTable: 'evaluations' });
    reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          평가 관리
        </h2>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors">
          <Plus className="w-3.5 h-3.5" />
          평가 등록
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          {TYPE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeTab(t)}
              className={`px-3 py-1.5 rounded-md transition-colors ${typeTab === t ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="전체">상태 전체</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex-1 min-w-[160px] flex items-center gap-2">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">완료율 {progress}% ({completedCount}/{filtered.length})</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-360px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">대상자</th>
                <th className="px-3 py-2.5">유형</th>
                <th className="px-3 py-2.5">단계</th>
                <th className="px-3 py-2.5">평가자</th>
                <th className="px-3 py-2.5">마감일</th>
                <th className="px-3 py-2.5">자기점수</th>
                <th className="px-3 py-2.5">평가자점수</th>
                <th className="px-3 py-2.5">최종등급</th>
                <th className="px-3 py-2.5">상태</th>
                <th className="px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-400">조회 결과가 없습니다.</td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{empMap.get(e.employee_id)?._name ?? '(삭제된 직원)'}</td>
                    <td className="px-3 py-2.5">{e.type}</td>
                    <td className="px-3 py-2.5">{e.stage ?? '-'}</td>
                    <td className="px-3 py-2.5">{e.evaluator ?? '-'}</td>
                    <td className="px-3 py-2.5">{e.due_date ?? '-'}</td>
                    <td className="px-3 py-2.5">{e.self_score ?? '-'}</td>
                    <td className="px-3 py-2.5">{e.manager_score ?? '-'}</td>
                    <td className="px-3 py-2.5 font-bold">{e.final_grade ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${STATUS_BADGE[e.status]}`}>{e.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(e)} aria-label="수정" className="p-1 rounded text-blue-600 hover:bg-blue-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(e)} aria-label="삭제" className="p-1 rounded text-rose-600 hover:bg-rose-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{editing ? '평가 수정' : '평가 등록'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-3 text-xs">
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">대상 직원 *</label>
                {editing ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">{empMap.get(form.employee_id)?._name ?? form.employee_id}</div>
                ) : (
                  <EmployeePicker employees={employees} value={form.employee_id || null} onChange={(id) => setForm((f) => ({ ...f, employee_id: id }))} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">유형</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EvaluationRecord['type'] }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {(['수습', '역량', '성과'] as const).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">단계</label>
                  <input type="text" placeholder="예: 1차 수습 (1개월)" value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">평가자</label>
                  <input type="text" value={form.evaluator} onChange={(e) => setForm((f) => ({ ...f, evaluator: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">상태</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EvaluationRecord['status'] }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">마감일</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">제출일</label>
                  <input type="date" value={form.submitted_date} onChange={(e) => setForm((f) => ({ ...f, submitted_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">자기점수</label>
                  <input type="number" min={0} max={100} value={form.self_score} onChange={(e) => setForm((f) => ({ ...f, self_score: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">평가자점수</label>
                  <input type="number" min={0} max={100} value={form.manager_score} onChange={(e) => setForm((f) => ({ ...f, manager_score: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">최종등급</label>
                  <select value={form.final_grade} onChange={(e) => setForm((f) => ({ ...f, final_grade: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">미정</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">피드백</label>
                  <textarea value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors">취소</button>
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
