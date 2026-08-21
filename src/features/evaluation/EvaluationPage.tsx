/**
 * 평가관리(T11.10) — 원본 EvaluationManagement/EvaluationDetailModal UI 재사용.
 * DB(evaluations) 조회 → EvaluationItem[] 매핑 → 목록/심의 모달 연동. 평가 등록은 기존 폼 흐름 유지.
 */
import { useEffect, useMemo, useState } from 'react';
import { Award, Plus, Loader2, X } from 'lucide-react';
import { listEmployees, listEvaluations, createEvaluation, updateEvaluation, type Employee, type EvaluationRecord } from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';
import { EvaluationManagement, type EvaluationItem } from '../../components/EvaluationManagement';
import { EvaluationDetailModal } from '../../components/EvaluationDetailModal';

const TYPE_LABEL: Record<EvaluationRecord['type'], EvaluationItem['type']> = {
  수습: '수습평가',
  역량: '역량평가',
  성과: '성과평가',
};
const GRADE_OPTIONS = ['S', 'A', 'B', 'C', 'D'];

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

function toEvalItem(e: EvaluationRecord, empMap: Map<string, Employee>): EvaluationItem {
  const emp = empMap.get(e.employee_id);
  return {
    id: e.id,
    type: TYPE_LABEL[e.type],
    targetName: emp?._name ?? '(삭제된 직원)',
    department: emp?._team ?? '-',
    position: emp?._grade ?? '-',
    evaluatorName: e.evaluator ?? '-',
    evaluatorPosition: '',
    stage: e.stage ?? '-',
    status: e.status,
    dueDate: e.due_date ?? '-',
    selfScore: e.self_score ?? undefined,
    managerScore: e.manager_score ?? undefined,
    finalGrade: (e.final_grade as EvaluationItem['finalGrade']) || undefined,
    feedbackSummary: e.feedback ?? undefined,
    submittedDate: e.submitted_date ?? undefined,
  };
}

export function EvaluationPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState<EvaluationItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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

  const items = useMemo(() => evaluations.map((e) => toEvalItem(e, empMap)), [evaluations, empMap]);

  const openCreate = () => {
    setForm(emptyForm());
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
      const id = await createEvaluation(fields);
      if (!id) throw new Error('등록에 실패했습니다.');
      await logEvent('create_evaluation', { targetId: id, targetTable: 'evaluations', meta: { type: form.type } });
      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: EvaluationItem['status'],
    grade?: EvaluationItem['finalGrade'],
    feedback?: string
  ) => {
    const ok = await updateEvaluation(id, { status, final_grade: grade ?? null, feedback: feedback ?? null });
    if (!ok) return;
    await logEvent('update_evaluation', { targetId: id, targetTable: 'evaluations' });
    reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors">
          <Plus className="w-3.5 h-3.5" />
          평가 등록
        </button>
      </div>

      <EvaluationManagement
        evaluations={items}
        onOpenEvalModal={(item) => setDetailItem(item)}
        onUpdateEvalStatus={handleUpdateStatus}
      />

      <EvaluationDetailModal
        item={detailItem}
        isOpen={detailItem !== null}
        onClose={() => setDetailItem(null)}
        onUpdateStatus={handleUpdateStatus}
      />

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                평가 등록
              </h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-3 text-xs">
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}
              <div>
                <label className="block font-bold text-slate-700 mb-1">대상 직원 *</label>
                <EmployeePicker employees={employees} value={form.employee_id || null} onChange={(id) => setForm((f) => ({ ...f, employee_id: id }))} />
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
                    {(['미작성', '진행중', '완료'] as const).map((s) => (
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
