/**
 * 계정·역할 관리(T12.1). profiles+user_roles 조인 목록(이메일·이름·부서·역할·활성) — 역할 변경/
 * 계정 활성화 토글. 관리자만 접근(App.tsx 게이트, AuditLogPage 와 동일). 신규 계정 생성은 브라우저에서
 * 불가(Auth admin API 는 service_role 필요) → Studio 안내 문구로 대체.
 */
import { useEffect, useMemo, useState } from 'react';
import { UserCog, Loader2 } from 'lucide-react';
import {
  listProfilesFull,
  listUserRoles,
  updateUserRole,
  setProfileEnabled,
  type AdminProfileRow,
  type UserRoleRow,
} from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { useAuth, type Role } from '../../lib/auth';

const ROLE_OPTIONS: Role[] = ['사용자', '관리자'];

export function UsersPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([listProfilesFull(), listUserRoles()]).then(([p, r]) => {
      setProfiles(p);
      setRoles(r);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.user_id, r.role])), [roles]);
  const adminCount = useMemo(() => roles.filter((r) => r.role === '관리자').length, [roles]);

  const handleRoleChange = async (targetId: string, from: string, to: Role) => {
    setError(null);
    if (targetId === user?.id) {
      setError('본인 계정의 역할은 스스로 변경할 수 없습니다.');
      return;
    }
    if (from === '관리자' && to === '사용자' && adminCount <= 1) {
      setError('마지막 관리자는 강등할 수 없습니다. 다른 계정을 먼저 관리자로 지정하세요.');
      return;
    }
    setBusyId(targetId);
    const ok = await updateUserRole(targetId, to);
    if (ok) {
      await logEvent('role_change', { targetId, targetTable: 'user_roles', meta: { from, to } });
      reload();
    } else {
      setError('역할 변경에 실패했습니다.');
    }
    setBusyId(null);
  };

  const handleToggleEnabled = async (row: AdminProfileRow) => {
    setError(null);
    setBusyId(row.id);
    const next = !row.enabled;
    const ok = await setProfileEnabled(row.id, next);
    if (ok) {
      await logEvent('toggle_account', { targetId: row.id, targetTable: 'profiles', meta: { enabled: next } });
      reload();
    } else {
      setError('계정 상태 변경에 실패했습니다.');
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCog className="w-5 h-5 text-blue-600" />
          계정·역할 관리
        </h2>
        <span className="text-xs text-slate-500">전체 {profiles.length}명 · 관리자 {adminCount}명</span>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        신규 계정은 Supabase Studio(Authentication)에서 생성한 뒤, 이 화면에서 역할을 부여하세요. 브라우저에서 직접
        계정을 생성하는 기능은 제공하지 않습니다.
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-360px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">이메일</th>
                <th className="px-3 py-2.5">이름</th>
                <th className="px-3 py-2.5">부서</th>
                <th className="px-3 py-2.5">역할</th>
                <th className="px-3 py-2.5">상태</th>
                <th className="px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">불러오는 중...</td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">조회 결과가 없습니다.</td>
                </tr>
              ) : (
                profiles.map((p) => {
                  const role = (roleMap.get(p.id) as Role | undefined) ?? '사용자';
                  const isSelf = p.id === user?.id;
                  const busy = busyId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2.5">{p.email ?? '-'}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{p.name ?? '-'}</td>
                      <td className="px-3 py-2.5">{p.dept ?? '-'}</td>
                      <td className="px-3 py-2.5">
                        <select
                          aria-label="역할"
                          value={role}
                          disabled={isSelf || busy}
                          title={isSelf ? '본인 계정의 역할은 스스로 변경할 수 없습니다.' : undefined}
                          onChange={(e) => handleRoleChange(p.id, role, e.target.value as Role)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            p.enabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {p.enabled ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleEnabled(p)}
                          disabled={busy}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                          {p.enabled ? '비활성화' : '활성화'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
