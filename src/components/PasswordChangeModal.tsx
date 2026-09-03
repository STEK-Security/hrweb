/**
 * 본인 비밀번호 변경 모달. Navbar 사용자 영역에서 열린다.
 * 현재 비밀번호 확인 → 새 비밀번호·확인 일치·최소 길이는 클라이언트에서 먼저 막고,
 * 실제 변경과 최종 판정은 auth.ts changePassword(GoTrue)가 한다.
 */
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { changePassword, PASSWORD_MIN_LENGTH } from '../lib/auth';

interface Props {
  onClose: () => void;
}

export function PasswordChangeModal({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError(`새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (next !== confirm) {
      setError('새 비밀번호와 확인 값이 일치하지 않습니다.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={id} className="text-[11px] text-slate-500 block mb-0.5">{label}</label>
      <input
        id={id}
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => set(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-change-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 id="pw-change-title" className="text-base font-bold text-slate-900">비밀번호 변경</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-5 space-y-4 text-sm">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold">
              비밀번호가 변경되었습니다. 다른 기기의 로그인은 해제됩니다.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="p-5 space-y-4 text-sm"
          >
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
                {error}
              </div>
            )}
            {field('pw-current', '현재 비밀번호', current, setCurrent, 'current-password')}
            {field('pw-next', `새 비밀번호 (${PASSWORD_MIN_LENGTH}자 이상)`, next, setNext, 'new-password')}
            {field('pw-confirm', '새 비밀번호 확인', confirm, setConfirm, 'new-password')}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                변경
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
