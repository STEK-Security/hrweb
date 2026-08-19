import React, { useState } from 'react';
import { Lock, User, ShieldCheck, AlertCircle } from 'lucide-react';

export interface DemoAccount {
  id: string;
  pw: string;
  name: string;
  dept: string;
  role: '시스템관리자' | '인사담당자' | '팀장' | '일반사용자';
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 'admin', pw: 'admin1234', name: '관리자', dept: '인사전략처', role: '시스템관리자' },
  { id: 'hr', pw: 'hr1234', name: '김인사', dept: '인사전략처', role: '인사담당자' },
  { id: 'lead', pw: 'lead1234', name: '박팀장', dept: '생산본부', role: '팀장' },
  { id: 'user', pw: 'user1234', name: '김사원', dept: '경영지원본부', role: '일반사용자' },
];

interface LoginViewProps {
  onLogin: (a: DemoAccount) => void;
}

const features = [
  '인력·인건비·조직 현황을 한 화면에서 실시간 확인',
  '휴직·복직, 수습평가, 교육 일정을 자동으로 동기화',
  '엑셀 인사기초정보를 업로드해 즉시 데이터 반영',
  '부서·법인별 권한에 따라 필요한 정보만 안전하게 열람',
];

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [id, setId] = useState('hr');
  const [pw, setPw] = useState('hr1234');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = DEMO_ACCOUNTS.find((a) => a.id === id && a.pw === pw);
    if (!matched) {
      setError(true);
      return;
    }
    setError(false);
    onLogin(matched);
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
              <label htmlFor="login-id" className="block text-xs font-semibold text-slate-700 mb-1.5">
                아이디
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-id"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
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
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
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
                <span>아이디 또는 비밀번호가 올바르지 않습니다.</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-login-submit"
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
            >
              로그인
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">데모 계정으로 바로 체험하기</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  id={`btn-demo-login-${a.id}`}
                  onClick={() => {
                    setId(a.id);
                    setPw(a.pw);
                    setError(false);
                    onLogin(a);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <span className="text-blue-600 font-bold">{a.role}</span>
                  <span className="text-slate-400">{a.id}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-5">
            데모 인증입니다. 실제 계정 체계는 사내 SSO 연동 시 교체됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};
