import { useState } from 'react';
import { useAuth, signOut } from './lib/auth';
import { LoginPage } from './features/auth/LoginPage';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { RosterPage } from './features/roster/RosterPage';
import type { ActiveMenu } from './types';

export default function App() {
  const { session, user, role, loading } = useAuth();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('대시보드');

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

  const displayName = user?.email ?? '사용자';

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar
        activeMenu={activeMenu}
        onSelectMenu={setActiveMenu}
        user={{ name: displayName, dept: '', role: role ?? '일반' }}
        onLogout={signOut}
      />
      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-6">
        {activeMenu === '인력현황' ? <RosterPage /> : <DashboardPage />}
      </main>
    </div>
  );
}
