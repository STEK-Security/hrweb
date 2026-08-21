/**
 * 인사발령이력(T11.5) — employee_transfers 조회(전체/직원별) + 등록·수정·삭제.
 * 발령 등록 시 "직원 정보에도 반영" 옵션을 켜면 employees."소속"/"직급" 도 함께 update.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import {
  listEmployees,
  listTransfers,
  createTransfer,
  updateTransfer,
  deleteTransfer,
  updateEmployee,
  type Employee,
  type TransferRecord,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';

const TRANSFER_TYPES = ['부서이동', '승진', '전보', '직책변경', '기타'];

interface TransferFormState {
  employee_id: string;
  transfer_date: string;
  transfer_type: string;
  prev_org: string;
  new_org: string;
  prev_position: string;
  new_position: string;
  order_title: string;
  note: string;
  syncEmployee: boolean;
}

function emptyForm(emp?: Employee): TransferFormState {
  return {
    employee_id: (emp?.['id'] as string) ?? '',
    transfer_date: '',
    transfer_type: TRANSFER_TYPES[0],
    prev_org: (emp?.['소속'] as string) ?? '',
    new_org: '',
    prev_position: (emp?.['직급'] as string) ?? '',
    new_position: '',
    order_title: '',
    note: '',
    syncEmployee: true,
  };
}

export function TransfersPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransferRecord | null>(null);
  const [form, setForm] = useState<TransferFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([listEmployees(), listTransfers()]).then(([emps, recs]) => {
      setEmployees(emps);
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

  const filtered = filterEmployeeId ? records.filter((r) => r.employee_id === filterEmployeeId) : records;

  const openCreate = () => {
    setEditing(null);
    const emp = filterEmployeeId ? empMap.get(filterEmployeeId) : undefined;
    setForm(emptyForm(emp));
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (r: TransferRecord) => {
    setEditing(r);
    setForm({
      employee_id: r.employee_id,
      transfer_date: r.transfer_date,
      transfer_type: r.transfer_type,
      prev_org: r.prev_org ?? '',
      new_org: r.new_org ?? '',
      prev_position: r.prev_position ?? '',
      new_position: r.new_position ?? '',
      order_title: r.order_title ?? '',
      note: r.note ?? '',
      syncEmployee: false,
    });
    setError(null);
    setFormOpen(true);
  };

  const handleDelete = async (r: TransferRecord) => {
    if (!window.confirm('이 발령 이력을 삭제할까요?')) return;
    const ok = await deleteTransfer(r.id);
    if (!ok) return;
    await logEvent('delete_transfer', { targetId: r.id, targetTable: 'employee_transfers' });
    reload();
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.employee_id) {
      setError('직원을 선택하세요.');
      return;
    }
    if (!form.transfer_date) {
      setError('발령일은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        employee_id: form.employee_id,
        transfer_date: form.transfer_date,
        transfer_type: form.transfer_type,
        prev_org: form.prev_org.trim() || null,
        new_org: form.new_org.trim() || null,
        prev_position: form.prev_position.trim() || null,
        new_position: form.new_position.trim() || null,
        order_title: form.order_title.trim() || null,
        note: form.note.trim() || null,
      };

      let id: string | null;
      if (editing) {
        const ok = await updateTransfer(editing.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
        id = editing.id;
      } else {
        id = await createTransfer(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }

      if (!editing && form.syncEmployee && (form.new_org.trim() || form.new_position.trim())) {
        const empFields: Record<string, string | null> = {};
        if (form.new_org.trim()) empFields['소속'] = form.new_org.trim();
        if (form.new_position.trim()) empFields['직급'] = form.new_position.trim();
        await updateEmployee(form.employee_id, empFields);
      }

      await logEvent(editing ? 'update_transfer' : 'create_transfer', {
        targetId: id ?? undefined,
        targetTable: 'employee_transfers',
        meta: { transfer_type: form.transfer_type },
      });

      setFormOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-blue-600" />
          인사발령 이력
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">조회 {filtered.length}건 / 전체 {records.length}건</span>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            발령 등록
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-700">직원 필터</span>
        <div className="w-64">
          <EmployeePicker
            employees={employees}
            value={filterEmployeeId}
            onChange={(id) => setFilterEmployeeId(id || null)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-340px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">발령일</th>
                <th className="px-3 py-2.5">성명</th>
                <th className="px-3 py-2.5">발령유형</th>
                <th className="px-3 py-2.5">이전소속 → 이후소속</th>
                <th className="px-3 py-2.5">이전직급 → 이후직급</th>
                <th className="px-3 py-2.5">발령명</th>
                <th className="px-3 py-2.5">비고</th>
                <th className="px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">불러오는 중...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-400">조회 결과가 없습니다.</td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const emp = empMap.get(r.employee_id);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.transfer_date}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{emp?._name ?? '(삭제된 직원)'}</td>
                      <td className="px-3 py-2.5">{r.transfer_type}</td>
                      <td className="px-3 py-2.5">{r.prev_org ?? '-'} → {r.new_org ?? '-'}</td>
                      <td className="px-3 py-2.5">{r.prev_position ?? '-'} → {r.new_position ?? '-'}</td>
                      <td className="px-3 py-2.5">{r.order_title ?? '-'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.note ?? '-'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openEdit(r)} aria-label="수정" className="p-1 rounded text-blue-600 hover:bg-blue-50">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(r)} aria-label="삭제" className="p-1 rounded text-rose-600 hover:bg-rose-50">
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

      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{editing ? '발령 이력 수정' : '발령 등록'}</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="닫기" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="space-y-3 text-xs"
            >
              {error && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">{error}</div>}

              <div>
                <label className="block font-bold text-slate-700 mb-1">대상 직원 *</label>
                {editing ? (
                  <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600">
                    {empMap.get(form.employee_id)?._name ?? form.employee_id}
                  </div>
                ) : (
                  <EmployeePicker
                    employees={employees}
                    value={form.employee_id || null}
                    onChange={(id, emp) =>
                      setForm((f) => ({
                        ...f,
                        employee_id: id,
                        prev_org: (emp['소속'] as string) ?? '',
                        prev_position: (emp['직급'] as string) ?? '',
                      }))
                    }
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">발령일 *</label>
                  <input
                    type="date"
                    value={form.transfer_date}
                    onChange={(e) => setForm((f) => ({ ...f, transfer_date: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">발령유형</label>
                  <select
                    value={form.transfer_type}
                    onChange={(e) => setForm((f) => ({ ...f, transfer_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TRANSFER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이전소속</label>
                  <input
                    type="text"
                    value={form.prev_org}
                    onChange={(e) => setForm((f) => ({ ...f, prev_org: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이후소속</label>
                  <input
                    type="text"
                    value={form.new_org}
                    onChange={(e) => setForm((f) => ({ ...f, new_org: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이전직급</label>
                  <input
                    type="text"
                    value={form.prev_position}
                    onChange={(e) => setForm((f) => ({ ...f, prev_position: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">이후직급</label>
                  <input
                    type="text"
                    value={form.new_position}
                    onChange={(e) => setForm((f) => ({ ...f, new_position: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">발령명</label>
                  <input
                    type="text"
                    placeholder="예: 2026년 하반기 정기발령"
                    value={form.order_title}
                    onChange={(e) => setForm((f) => ({ ...f, order_title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">비고</label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {!editing && (
                  <div className="col-span-2 flex items-center gap-2">
                    <input
                      id="sync-employee"
                      type="checkbox"
                      checked={form.syncEmployee}
                      onChange={(e) => setForm((f) => ({ ...f, syncEmployee: e.target.checked }))}
                      className="w-3.5 h-3.5"
                    />
                    <label htmlFor="sync-employee" className="font-bold text-slate-700">
                      직원 정보(소속/직급)에도 반영
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
