import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { signIn } from '../../lib/auth';

const features = [
  '인력·인건비·조직 현황을 한 화면에서 실시간 확인',
  '휴직·복직, 수습평가, 교육 일정을 자동으로 동기화',
  '부서·법인별 권한에 따라 필요한 정보만 안전하게 열람',
];

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-[940px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden grid md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-blue-700 to-blue-500 text-white p-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-xs">
              <div className="w-3.5 h-3.5 bg-blue-600 rounded-xs"></div>
            </div>
            <span className="font-bold text-lg tracking-tight">STEK HR</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-2xl font-bold leading-snug">
              통합 사내 HR
              <br />
              인사정보 시스템
            </h1>
            <ul className="space-y-2.5 text-sm text-blue-50">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-100" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-blue-100">© 2026 STEK & TBS. All rights reserved.</p>
        </div>

        {/* Login form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6 md:hidden flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
              <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
            </div>
            <span className="font-bold text-lg tracking-tight text-blue-950">STEK HR</span>
          </div>

          <h2 className="text-xl font-bold text-blue-950">로그인</h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            사내 계정으로 로그인하여 HR 시스템을 이용하세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm" autoComplete="on">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                이메일
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-pw" className="block text-xs font-semibold text-slate-700 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-pw"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-login-submit"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-[11px] text-slate-400 mt-5">
            계정이 없으신가요? 관리자에게 문의해주세요. 비밀번호를 잊으셨다면 관리자에게 초기화를 요청하세요.
          </p>
        </div>
      </div>
    </div>
  );
};
