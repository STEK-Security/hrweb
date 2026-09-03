import React, { useState } from 'react';
import { ActiveMenu } from '../types';
import {
  LayoutDashboard,
  Users,
  Users2,
  Building2,
  UserCheck,
  Calendar,
  FileSpreadsheet,
  ClipboardCheck,
  LogOut,
  ShieldAlert,
  ArrowLeftRight,
  GraduationCap,
  Award,
  Wallet,
  UserCog,
  Settings,
  Mail,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { PasswordChangeModal } from './PasswordChangeModal';

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
  /** 관리자만 "감사로그" 메뉴 노출 */
  isAdmin?: boolean;
  /** 전역검색에서 직원을 선택했을 때(EmployeeDrawer 오픈) */
  onSelectEmployee?: (id: string) => void;
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
  isAdmin,
  onSelectEmployee,
}) => {
  // 비밀번호 변경 모달은 Navbar 가 직접 연다 — App 까지 prop 을 뚫을 이유가 없다(로그인 상태에서만 노출).
  const [pwOpen, setPwOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // 로그인 여부와 무관하게 같은 프로필 표기를 쓴다(메뉴만 로그인 시 붙는다).
  const userBlock = (
    <>
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
    </>
  );

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
      id: '직원명부',
      label: '직원 명부',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      id: '발령이력',
      label: '발령 이력',
      icon: <ArrowLeftRight className="w-4 h-4" />,
    },
    {
      id: '구성다양성',
      label: '구성·다양성',
      icon: <Users2 className="w-4 h-4" />,
    },
    {
      id: '조직도',
      label: '조직도',
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: '휴직자관리',
      label: '휴직자 관리',
      icon: <UserCheck className="w-4 h-4" />,
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
    {
      id: '인건비',
      label: '인건비',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: '데이터품질',
      label: '데이터품질',
      icon: <ClipboardCheck className="w-4 h-4" />,
    },
    {
      id: '메일발송',
      label: '메일 발송',
      icon: <Mail className="w-4 h-4" />,
    },
    ...(isAdmin
      ? [
          {
            id: '감사로그' as ActiveMenu,
            label: '감사로그',
            icon: <ShieldAlert className="w-4 h-4" />,
          },
          {
            id: '계정관리' as ActiveMenu,
            label: '계정관리',
            icon: <UserCog className="w-4 h-4" />,
          },
          {
            id: '설정' as ActiveMenu,
            label: '설정',
            icon: <Settings className="w-4 h-4" />,
          },
        ]
      : []),
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

          {/* 전역검색 */}
          {onSelectEmployee && (
            <div className="hidden md:block flex-1 max-w-xs mx-4">
              <GlobalSearch onSelectEmployee={onSelectEmployee} />
            </div>
          )}

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

            {/* 사용자 영역 — 아바타 클릭 시 계정 메뉴. 아이콘만 두면 비밀번호 변경을 못 찾는다. */}
            {onLogout ? (
              <div
                className="relative"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setMenuOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2.5 pl-1 pr-1.5 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {userBlock}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {menuOpen && (
                  <>
                    {/* ponytail: 바깥 클릭 닫기를 document 리스너 대신 투명 오버레이로 — 정리할 이펙트가 없다. */}
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="계정 메뉴 닫기"
                      onClick={() => setMenuOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1.5 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl py-1 overflow-hidden"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          setPwOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        비밀번호 변경
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        로그아웃
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 pl-1">{userBlock}</div>
            )}
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
      {pwOpen && <PasswordChangeModal onClose={() => setPwOpen(false)} />}
    </header>
  );
};
