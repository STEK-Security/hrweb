/**
 * 인건비 — 원천데이터(급여시스템 연동)가 없어 화면만 준비중 placeholder 로 둔다(Phase11 결정).
 */
import { Wallet } from 'lucide-react';

export function PayrollPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
      <Wallet className="w-10 h-10 text-slate-300 mb-3" />
      <h2 className="text-lg font-bold text-slate-700">인건비 — 준비중</h2>
      <p className="mt-1.5 text-sm text-slate-500">급여시스템 연동 예정입니다. 원천데이터 연결 후 제공됩니다.</p>
    </div>
  );
}
