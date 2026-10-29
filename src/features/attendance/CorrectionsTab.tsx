/** 근태관리 '정정·승인' 탭 — 인사팀 승인/반려, 승인 취소(사유 필수 → 당사자가 time.stek.win 에서 보고 다시 신청). GET/POST /corrections. */
import { useCallback, useEffect, useState } from 'react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { errorText } from './labels';

interface Correction {
  id: number;
  sabun: string;
  name: string | null;
  work_date: string;
  kind: string;
  req_in: string | null;
  req_out: string | null;
  reason_type: string | null;
  reason_text: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approver: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
}

type Filter = 'pending' | 'approved' | 'all' | 'stuck';
const STATUS: Record<string, string> = { pending: '대기', approved: '승인', rejected: '반려', cancelled: '본인 취소' };
const statusText = (c: Correction) => (c.revoked_at ? '인사팀 취소' : STATUS[c.status] ?? c.status);
const hhmm = (s: string | null) => (s ? s.slice(11, 16) : '—');

export function CorrectionsTab({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<Correction[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<Correction | null>(null);
  const [revoking, setRevoking] = useState<Correction | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    const query: Record<string, string> = filter === 'all' ? {} : { status: filter === 'approved' ? 'approved' : 'pending' };
    if (filter === 'stuck') query.stuck = '1';
    setError('');
    att<Correction[]>('GET', '/api/admin/corrections', { query })
      .then((r) => setRows(filter === 'all' ? r : [...r].sort((a, b) => +(b.approver === 'HR') - +(a.approver === 'HR')))) // 팀장 본인 신청(HR 승인) 상단
      .catch((e) => { setRows([]); setError(errorText(e)); });
  }, [filter]);
  useEffect(load, [load]);

  const decide = async (c: Correction, decision: 'approve' | 'reject', text?: string) => {
    setBusy(true);
    setError('');
    try {
      await att('POST', `/api/admin/corrections/${c.id}`, { body: { decision, note: text } });
      await logEvent('attendance.correction', { meta: { correctionId: c.id, sabun: c.sabun, date: c.work_date, decision } });
      setRejecting(null);
      setNote('');
      load();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (c: Correction, reason: string) => {
    setBusy(true);
    setError('');
    try {
      await att('POST', `/api/admin/corrections/${c.id}/revoke`, { body: { reason: reason.trim() } });
      await logEvent('attendance.correction', { meta: { correctionId: c.id, sabun: c.sabun, date: c.work_date, decision: 'revoke', reason: reason.trim() } });
      setRevoking(null);
      setNote('');
      load();
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5" role="group" aria-label="정정 필터">
        {([['pending', '대기'], ['stuck', '팀장 미처리'], ['approved', '승인'], ['all', '전체']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'}`}>
            {l}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">
              {['신청자', '날짜', '요청 시각', '사유', '승인자', '상태', '처리', ''].map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null && <tr><td colSpan={8} className="p-6 text-center text-slate-400">불러오는 중…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">정정 신청이 없습니다.</td></tr>}
            {rows?.map((c) => (
              <tr key={c.id} className={c.status === 'pending' && c.approver === 'HR' ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{c.name ?? '—'} <span className="font-normal text-slate-400">{c.sabun}</span></td>
                <td className="px-3 py-2 whitespace-nowrap">{c.work_date}</td>
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">{hhmm(c.req_in)} ~ {hhmm(c.req_out)}</td>
                <td className="px-3 py-2 min-w-40">{[c.reason_type, c.reason_text].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.approver === 'HR' ? '인사팀' : c.approver}</td>
                <td className={`px-3 py-2 whitespace-nowrap font-semibold ${c.revoked_at ? 'text-rose-600' : ''}`}>{statusText(c)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                  {c.decided_at ? `${c.decided_at.slice(0, 16).replace('T', ' ')} ${c.decided_by ?? ''}` : '—'}
                  {c.decision_note && <div className="text-slate-400">{c.decision_note}</div>}
                  {c.revoked_at && <div className="text-rose-600">취소 {c.revoked_at.slice(0, 16)} {c.revoked_by ?? ''} · {c.revoke_reason}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {c.status === 'pending' && (
                    <div className="flex gap-1">
                      <button type="button" disabled={busy} onClick={() => window.confirm(`${c.name ?? c.sabun} ${c.work_date} 정정을 승인하시겠습니까?`) && decide(c, 'approve')}
                        className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-semibold cursor-pointer disabled:opacity-50">승인</button>
                      <button type="button" disabled={busy} onClick={() => { setRejecting(c); setNote(''); }}
                        className="px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 font-semibold cursor-pointer disabled:opacity-50">반려</button>
                    </div>
                  )}
                  {c.status === 'approved' && (
                    <button type="button" disabled={busy} onClick={() => { setRevoking(c); setNote(''); }}
                      className="px-2.5 py-1 rounded-md border border-rose-200 text-rose-600 font-semibold cursor-pointer disabled:opacity-50">승인 취소</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rejecting && (
        <div role="dialog" aria-modal="true" aria-label="반려 사유" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onKeyDown={(e) => e.key === 'Escape' && setRejecting(null)}>
          <form className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3"
            onSubmit={(e) => { e.preventDefault(); decide(rejecting, 'reject', note); }}>
            <h2 className="text-sm font-bold text-slate-900">{rejecting.name ?? rejecting.sabun} {rejecting.work_date} 반려</h2>
            <label className="block text-xs font-semibold text-slate-600">
              반려 사유 (2자 이상)
              <textarea autoFocus required minLength={2} value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer">취소</button>
              <button type="submit" disabled={busy || note.trim().length < 2} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">반려</button>
            </div>
          </form>
        </div>
      )}
      {revoking && (
        <div role="dialog" aria-modal="true" aria-label="승인 취소 사유" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onKeyDown={(e) => e.key === 'Escape' && setRevoking(null)}>
          <form className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3"
            onSubmit={(e) => { e.preventDefault(); revoke(revoking, note); }}>
            <h2 className="text-sm font-bold text-slate-900">{revoking.name ?? revoking.sabun} {revoking.work_date} 승인 취소</h2>
            <p className="text-[11px] text-slate-500">
              승인된 {revoking.kind === 'hr_edit' ? 'HR 수정' : '정정'}({hhmm(revoking.req_in)} ~ {hhmm(revoking.req_out)})을 취소하고 그날을 원래 출입기록으로 다시 계산합니다.
              당사자는 time.stek.win 신청 내역에서 아래 사유를 보고 다시 신청할 수 있습니다.
            </p>
            <label className="block text-xs font-semibold text-slate-600">
              취소 사유 (2자 이상, 당사자에게 보임)
              <textarea autoFocus required minLength={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRevoking(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer">닫기</button>
              <button type="submit" disabled={busy || note.trim().length < 2} className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">승인 취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
