import { useState } from 'react';
import { useAuth, signOut } from './lib/auth';
import { logEvent } from './lib/audit';
import { LoginPage } from './features/auth/LoginPage';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { RosterPage } from './features/roster/RosterPage';
import { AuditLogPage } from './features/admin/AuditLogPage';
import type { ActiveMenu } from './types';

export default function App() {
  const { session, user, role, roleError, loading } = useAuth();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('대시보드');
  const isAdmin = role === '관리자';

  const handleSelectMenu = (menu: ActiveMenu) => {
    if (menu === '감사로그' && !isAdmin) return; // 관리자 외 화면 접근 차단
    setActiveMenu(menu);
    logEvent('view_screen', { meta: { screen: menu } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-900">
        <div className="text-center">
          <h1 className="text-xl font-bold">STEK HR</h1>
          <p className="mt-2 text-sm text-slate-500">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  if (roleError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-900">
        <div className="text-center">
          <h1 className="text-xl font-bold">STEK HR</h1>
          <p className="mt-2 text-sm text-red-600">권한 확인에 실패했습니다. 새로고침하거나 관리자에게 문의하세요.</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-4 rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  const displayName = user?.email ?? '사용자';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar
        activeMenu={activeMenu}
        onSelectMenu={handleSelectMenu}
        user={{ name: displayName, dept: '', role: role ?? '사용자' }}
        onLogout={signOut}
        isAdmin={isAdmin}
      />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-6">
        {activeMenu === '인력현황' ? (
          <RosterPage />
        ) : activeMenu === '감사로그' && isAdmin ? (
          <AuditLogPage />
        ) : (
          <DashboardPage />
        )}
      </main>
    </div>
  );
}
