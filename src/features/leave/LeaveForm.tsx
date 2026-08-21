/**
 * 휴직 등록/수정 폼. leave_records 테이블에 직접 insert/update. employees 와의 연결(employee_id)은
 * 이 폼에서 다루지 않는다(사번 검색 UI 없이 성명 등을 직접 입력하는 기존 방식과 동일).
 */
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createLeave, updateLeave, type LeaveRecord } from '../../lib/db';
import { logEvent } from '../../lib/audit';

interface LeaveFormProps {
  /** null = 신규 등록 */
  record: LeaveRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS: LeaveRecord['status'][] = ['휴직중', '복직예정', '복직완료'];

export function LeaveForm({ record, onClose, onSaved }: LeaveFormProps) {
  const isEdit = !!record;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: record?.name ?? '',
    dept: record?.dept ?? '',
    position: record?.position ?? '',
    reason: record?.reason ?? '',
    start_date: record?.start_date ?? '',
    expected_return_date: record?.expected_return_date ?? '',
    substitute_assigned: record?.substitute_assigned ?? false,
    substitute_name: record?.substitute_name ?? '',
    contact: record?.contact ?? '',
    status: record?.status ?? '휴직중',
  });

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('성명은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      const fields = {
        name: form.name.trim(),
        dept: form.dept.trim() || null,
        position: form.position.trim() || null,
        reason: form.reason.trim() || null,
        start_date: form.start_date || null,
        expected_return_date: form.expected_return_date || null,
        substitute_assigned: form.substitute_assigned,
        substitute_name: form.substitute_name.trim() || null,
        contact: form.contact.trim() || null,
        status: form.status,
      };

      let id: string | null = record?.id ?? null;
      if (isEdit && record) {
        const ok = await updateLeave(record.id, fields);
        if (!ok) throw new Error('저장에 실패했습니다.');
      } else {
        id = await createLeave(fields);
        if (!id) throw new Error('등록에 실패했습니다.');
      }

      await logEvent(isEdit ? 'update_leave' : 'create_leave', {
        targetId: id ?? undefined,
        targetTable: 'leave_records',
        meta: { changedFields: Object.keys(fields).length },
      });

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? '휴직자 정보 수정' : '휴직자 등록'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600"
          >
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
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">성명 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">소속 부서</label>
              <input
                type="text"
                value={form.dept}
                onChange={(e) => setField('dept', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">직급</label>
              <input
                type="text"
                value={form.position}
                onChange={(e) => setField('position', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">휴직 사유</label>
              <input
                type="text"
                placeholder="예: 육아휴직"
                value={form.reason}
                onChange={(e) => setField('reason', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">휴직 시작일</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setField('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">복직 예정일</label>
              <input
                type="date"
                value={form.expected_return_date}
                onChange={(e) => setField('expected_return_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">상태</label>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as LeaveRecord['status'])}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">연락처</label>
              <input
                type="text"
                placeholder="010-0000-0000"
                value={form.contact}
                onChange={(e) => setField('contact', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                id="substitute_assigned"
                type="checkbox"
                checked={form.substitute_assigned}
                onChange={(e) => setField('substitute_assigned', e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <label htmlFor="substitute_assigned" className="font-bold text-slate-700">
                대체인력 배치됨
              </label>
            </div>
            {form.substitute_assigned && (
              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">대체인력 성명</label>
                <input
                  type="text"
                  value={form.substitute_name}
                  onChange={(e) => setField('substitute_name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
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
  );
}
