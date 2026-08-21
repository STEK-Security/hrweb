/**
 * 관리자 감사로그 뷰어. audit_log 는 RLS 상 관리자만 조회 가능(append-only, 값 원본 없음).
 * 기간·action·actor·대상테이블 필터 + 페이지네이션. actor 는 profiles(이메일·이름) 조인해 표시.
 * reveal/read_ssn_full/role_change 는 오남용 감지를 위해 행을 강조한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { listAuditLog, listProfiles, type AuditLogRow, type ProfileLite } from '../../lib/db';

const PAGE_SIZE = 50;

const ACTION_OPTIONS = [
  'login_success', 'login_fail', 'logout',
  'view_screen', 'view_employee',
  'create_employee', 'update_employee', 'delete_employee',
  'create_leave', 'update_leave',
  'export', 'reveal', 'read_ssn_full', 'role_change',
  'set_sensitive',
] as const;

const HIGHLIGHT_ACTIONS = new Set(['reveal', 'read_ssn_full', 'role_change']);

function fmtTs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString('ko-KR', { hour12: false });
}

function actorLabel(row: AuditLogRow, profileMap: Map<string, ProfileLite>): string {
  if (row.actor) {
    const p = profileMap.get(row.actor);
    if (p) return `${p.name ?? '-'} (${p.email ?? row.actor})`;
    return row.actor;
  }
  return row.actor_email ? `${row.actor_email} (미인증)` : '-';
}

function targetLabel(row: AuditLogRow): string {
  const parts = [row.target_table, row.column_name].filter(Boolean);
  const label = parts.join(' · ') || '-';
  return row.target_id ? `${label} (${row.target_id.slice(0, 8)})` : label;
}

function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return '-';
  try {
    return JSON.stringify(meta);
  } catch {
    return '-';
  }
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetTable, setTargetTable] = useState('');

  useEffect(() => {
    listProfiles().then(setProfiles);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAuditLog(
      {
        from: from ? `${from}T00:00:00` : undefined,
        to: to ? `${to}T23:59:59` : undefined,
        action: action || undefined,
        actorId: actorId || undefined,
        targetTable: targetTable || undefined,
      },
      page,
      PAGE_SIZE
    ).then(({ rows: r, total: t }) => {
      if (cancelled) return;
      setRows(r);
      setTotal(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to, action, actorId, targetTable, page]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetToFirstPage = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600" />
          감사로그
        </h2>
        <span className="text-xs text-slate-500">전체 {total.toLocaleString()}건</span>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <input
          type="date"
          aria-label="시작일"
          value={from}
          onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-slate-400">~</span>
        <input
          type="date"
          aria-label="종료일"
          value={to}
          onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          aria-label="action"
          value={action}
          onChange={(e) => resetToFirstPage(setAction)(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">action 전체</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          aria-label="actor"
          value={actorId}
          onChange={(e) => resetToFirstPage(setActorId)(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">actor 전체</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.email ?? p.id}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label="대상 테이블"
          placeholder="대상 테이블(예: employees)"
          value={targetTable}
          onChange={(e) => resetToFirstPage(setTargetTable)(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-360px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">시각</th>
                <th className="px-3 py-2.5">actor</th>
                <th className="px-3 py-2.5">action</th>
                <th className="px-3 py-2.5">대상</th>
                <th className="px-3 py-2.5">IP</th>
                <th className="px-3 py-2.5">User-Agent</th>
                <th className="px-3 py-2.5">meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const highlighted = HIGHLIGHT_ACTIONS.has(row.action);
                  return (
                    <tr key={row.id} className={highlighted ? 'bg-rose-50/60' : undefined}>
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">{fmtTs(row.ts)}</td>
                      <td className="px-3 py-2.5">{actorLabel(row, profileMap)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-bold ${highlighted ? 'text-rose-700' : 'text-slate-700'}`}
                        >
                          {row.action}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{targetLabel(row)}</td>
                      <td className="px-3 py-2.5 font-mono">{row.ip ?? '-'}</td>
                      <td className="px-3 py-2.5 max-w-[220px] truncate" title={row.user_agent ?? ''}>
                        {row.user_agent ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px] truncate" title={metaSummary(row.meta)}>
                        {metaSummary(row.meta)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {total === 0 ? '0건' : `${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} / ${total}건`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50"
          >
            이전
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
