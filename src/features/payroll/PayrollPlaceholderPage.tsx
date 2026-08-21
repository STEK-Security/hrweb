/**
 * 인건비 — 원천데이터(급여시스템/n8n 연동)가 아직 없어 원본 데모데이터로 UI/UX 를 복원해 표시한다.
 */
import { PayrollAnalysis } from '../../components/PayrollAnalysis';

export function PayrollPlaceholderPage() {
  return (
    <div className="space-y-3">
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        데모 데이터 · 외부 연동 대기
      </span>
      <PayrollAnalysis />
    </div>
  );
}
