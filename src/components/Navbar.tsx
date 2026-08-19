import React from 'react';
import { ActiveMenu } from '../types';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  UserCheck,
  Calendar,
  GraduationCap,
  Award,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react';

interface NavbarProps {
  activeMenu: ActiveMenu;
  onSelectMenu: (menu: ActiveMenu) => void;
  selectedCorp?: string;
  onChangeCorp?: (corp: string) => void;
  /** 로그인 사용자 */
  user?: { name: string; dept: string; role: string };
  /** 적재된 엑셀 정보 */
  dataInfo?: { fileName: string; rowCount: number; excluded?: number } | null;
  /** 엑셀에서 읽어온 법인 목록 */
  corps?: string[];
  onLogout?: () => void;
  onOpenDataSource?: () => void;
  /** supabase 연결 상태 */
  sbStatus?: 'checking' | 'ok' | 'down' | 'off';
}

export const Navbar: React.FC<NavbarProps> = ({
  activeMenu,
  onSelectMenu,
  selectedCorp,
  onChangeCorp,
  user,
  dataInfo,
  corps,
  onLogout,
  onOpenDataSource,
  sbStatus,
}) => {
  const menuItems: { id: ActiveMenu; label: string; icon: React.ReactNode }[] = [
    {
      id: '대시보드',
      label: '대시보드',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: '캘린더',
      label: 'HR캘린더',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: '인력현황',
      label: '인력 현황',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: '휴직자관리',
      label: '휴직자 관리',
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: '인건비',
      label: '인건비',
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      id: '교육관리',
      label: '교육 관리',
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      id: '평가관리',
      label: '평가 관리',
      icon: <Award className="w-4 h-4" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-10">
        {/* Top bar */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            {/* Sleek Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <div className="w-3.5 h-3.5 bg-white rounded-xs"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-blue-950">
                  STEK HR
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* supabase 연결 상태 */}
            {sbStatus && sbStatus !== 'off' && (
              <span
                title={
                  sbStatus === 'ok' ? 'Supabase 연결됨 (api.hr.stek.kr)'
                  : sbStatus === 'checking' ? 'Supabase 연결 확인 중'
                  : 'Supabase 미연결 — 네트워크/도메인 확인 필요'
                }
                className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold ${
                  sbStatus === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : sbStatus === 'checking' ? 'bg-slate-50 border-slate-200 text-slate-500'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  sbStatus === 'ok' ? 'bg-emerald-500' : sbStatus === 'checking' ? 'bg-slate-400' : 'bg-rose-500'
                }`}></span>
                Supabase
              </span>
            )}
            {/* 데이터 원본 (업로드된 엑셀) */}
            {dataInfo && onOpenDataSource && (
              <button
                type="button"
                onClick={onOpenDataSource}
                title={`${dataInfo.fileName} · ${dataInfo.rowCount}명${dataInfo.excluded ? ` (테스트·GPRO ${dataInfo.excluded}건 제외)` : ''} — 클릭하면 다른 파일로 교체합니다`}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer max-w-[260px]"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-700 truncate">
                  {dataInfo.fileName}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                  {dataInfo.rowCount}명
                </span>
              </button>
            )}

            {/* 법인 필터 */}
            {corps && corps.length > 1 && onChangeCorp && (
              <select
                aria-label="법인 선택"
                value={selectedCorp || '전체 법인'}
                onChange={(e) => onChangeCorp(e.target.value)}
                className="hidden md:block px-2 py-1.5 rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="전체 법인">전체 법인</option>
                {corps.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Sleek User Profile Avatar */}
            <div className="flex items-center gap-3 pl-1">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {user ? user.name : '김인사 팀장'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {user ? `${user.dept} · ${user.role}` : '인사전략처'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-200 border-2 border-white shadow-xs flex items-center justify-center text-slate-600 font-bold text-xs">
                {(user ? user.name : '김')[0]}
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="로그아웃"
                  aria-label="로그아웃"
                  className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sleek Nav Tabs Bar */}
        <nav className="flex space-x-6 text-sm font-medium border-t border-slate-100 overflow-x-auto no-scrollbar" aria-label="사내 HR 메뉴">
          {menuItems.map((item) => {
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                id={`nav-menu-${item.id}`}
                type="button"
                onClick={() => onSelectMenu(item.id)}
                className={`flex items-center gap-2 py-3.5 text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer relative ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 font-bold -mb-px'
                    : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
