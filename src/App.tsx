import { useAuth, signOut } from './lib/auth';
import { LoginPage } from './features/auth/LoginPage';
import { Navbar } from './components/Navbar';
import type { ActiveMenu } from './types';

export default function App() {
  const { session, user, role, loading } = useAuth();

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
        activeMenu={'대시보드' as ActiveMenu}
        onSelectMenu={() => {}}
        user={{ name: displayName, dept: '', role: role ?? '일반' }}
        onLogout={signOut}
      />
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-lg font-bold">
          환영합니다, {displayName}({role ?? '일반'})
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          직원 명부/휴직/관리자 화면은 다음 단계에서 연결됩니다.
        </p>
      </main>
    </div>
  );
}
