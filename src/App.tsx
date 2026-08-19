import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveMenu,
  KPIData,
  MonthlyHireLeaverData,
  DetailedMatrixRow,
  CalendarEventItem,
  DailyChecklistItem,
  LeavePersonItem,
  EvaluationItem,
} from './types';
import {
  initialKPIData,
  monthlyHireLeaverData,
  detailedMatrixRows,
  initialCalendarEvents,
  initialChecklists,
  initialLeavePersons,
  initialEvaluations,
  applyExcelDataset,
  SAMPLE_ONLY,
} from './mockData';
import { Navbar } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { HeadcountAnalysis } from './components/HeadcountAnalysis';
import { PayrollAnalysis } from './components/PayrollAnalysis';
import { HRCalendarView } from './components/HRCalendarView';
import { TrainingManagement } from './components/TrainingManagement';
import { EvaluationManagement } from './components/EvaluationManagement';
import { LeaveManagement } from './components/LeaveManagement';
import { AddScheduleModal } from './components/AddScheduleModal';
import { EvaluationDetailModal } from './components/EvaluationDetailModal';
import { MonthDetailModal } from './components/MonthDetailModal';
import { DrilldownModal } from './components/DrilldownModal';
import { LoginView, DEMO_ACCOUNTS, DemoAccount } from './components/LoginView';
import { DataSourceView } from './components/DataSourceView';
import { SampleDataNotice } from './components/SampleDataNotice';
import { ParsedWorkbook, RawRow } from './excel/parse';
import { deriveAll, countExcluded } from './excel/derive';
import { buildDataset } from './excel/adapt';
import { checkSupabase, supabaseConfigured } from './lib/supabase';

/* ============================================================
   적재된 엑셀 정보
   ============================================================ */
interface DataInfo {
  fileName: string;
  sheetName: string;
  rowCount: number;
  loadedAt: Date;
  /** 테스트·GPRO 로 제외된 행 수 */
  excluded?: number;
}

const LS_DATA = 'stek-hr-data-v1';
const SS_USER = 'stek-hr-user-v1';

/** 엑셀 데이터를 화면 데이터에 반영하고 법인 목록을 돌려준다 */
function applyWorkbook(rows: RawRow[]): { corps: string[]; kept: number; excluded: number } {
  const excluded = countExcluded(rows);
  const employees = deriveAll(rows);          // 테스트·GPRO 행 제외
  const ds = buildDataset(employees, excluded);
  applyExcelDataset(ds);
  return { corps: ds.corps, kept: employees.length, excluded };
}

export default function App() {
  const [user, setUser] = useState<DemoAccount | null>(null);
  const [dataInfo, setDataInfo] = useState<DataInfo | null>(null);
  const [corps, setCorps] = useState<string[]>([]);
  const [showDataSource, setShowDataSource] = useState(false);
  const [version, setVersion] = useState(0);
  const [booted, setBooted] = useState(false);
  const [sbStatus, setSbStatus] = useState<'checking' | 'ok' | 'down' | 'off'>(
    supabaseConfigured ? 'checking' : 'off'
  );

  // supabase 연결 확인 (브라우저 → api.hr.stek.kr)
  useEffect(() => {
    if (!supabaseConfigured) { setSbStatus('off'); return; }
    let alive = true;
    checkSupabase().then((ok) => { if (alive) setSbStatus(ok ? 'ok' : 'down'); });
    return () => { alive = false; };
  }, []);

  /* 세션·데이터 복원 */
  useEffect(() => {
    try {
      const su = sessionStorage.getItem(SS_USER);
      if (su) {
        const parsed = JSON.parse(su) as { id: string };
        const found = DEMO_ACCOUNTS.find((a) => a.id === parsed.id);
        if (found) setUser(found);
      }
      const sd = localStorage.getItem(LS_DATA);
      if (sd) {
        const d = JSON.parse(sd) as { rows: RawRow[]; fileName: string; sheetName: string; loadedAt: string };
        if (d?.rows?.length) {
          const r = applyWorkbook(d.rows);
          setCorps(r.corps);
          setDataInfo({
            fileName: d.fileName, sheetName: d.sheetName,
            rowCount: r.kept, loadedAt: new Date(d.loadedAt), excluded: r.excluded,
          });
          setVersion((v) => v + 1);
        }
      }
    } catch {
      /* 복원 실패는 무시하고 초기 상태로 시작 */
    }
    setBooted(true);
  }, []);

  const handleLogin = useCallback((a: DemoAccount) => {
    setUser(a);
    sessionStorage.setItem(SS_USER, JSON.stringify({ id: a.id }));
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(SS_USER);
  }, []);

  const handleLoaded = useCallback((wb: ParsedWorkbook, fileName: string) => {
    const r = applyWorkbook(wb.rows);
    setCorps(r.corps);
    setDataInfo({ fileName, sheetName: wb.sheetName, rowCount: r.kept, loadedAt: new Date(), excluded: r.excluded });
    try {
      localStorage.setItem(LS_DATA, JSON.stringify({
        rows: wb.rows, fileName, sheetName: wb.sheetName, loadedAt: new Date().toISOString(),
      }));
    } catch {
      /* 용량 초과 시 저장만 생략 (화면에는 그대로 반영됨) */
    }
    setVersion((v) => v + 1);
    setShowDataSource(false);
  }, []);

  if (!booted) return null;
  if (!user) return <LoginView onLogin={handleLogin} />;

  if (!dataInfo || showDataSource) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navbar
          activeMenu="대시보드"
          onSelectMenu={() => { if (dataInfo) setShowDataSource(false); }}
          user={user}
          dataInfo={dataInfo}
          corps={corps}
          sbStatus={sbStatus}
          onLogout={handleLogout}
          onOpenDataSource={() => setShowDataSource(true)}
        />
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-6">
          <DataSourceView
            onLoaded={handleLoaded}
            current={dataInfo}
            onCancel={dataInfo ? () => setShowDataSource(false) : undefined}
          />
        </main>
      </div>
    );
  }

  return (
    <AppShell
      key={version}
      user={user}
      dataInfo={dataInfo}
      corps={corps}
      sbStatus={sbStatus}
      onLogout={handleLogout}
      onOpenDataSource={() => setShowDataSource(true)}
    />
  );
}

/* ============================================================
   기존 화면 셸 — 구조·디자인은 원본 그대로
   ============================================================ */
interface AppShellProps {
  user: DemoAccount;
  dataInfo: DataInfo;
  corps: string[];
  sbStatus: 'checking' | 'ok' | 'down' | 'off';
  onLogout: () => void;
  onOpenDataSource: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ user, dataInfo, corps, sbStatus, onLogout, onOpenDataSource }) => {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('대시보드');
  const [selectedCorp, setSelectedCorp] = useState<string>('전체 법인');

  // State Management
  const [kpiData] = useState<KPIData>(initialKPIData);
  const [monthlyData] = useState<MonthlyHireLeaverData[]>(monthlyHireLeaverData);
  const [matrixRows] = useState<DetailedMatrixRow[]>(detailedMatrixRows);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>(initialCalendarEvents);
  const [checklists, setChecklists] = useState<DailyChecklistItem[]>(initialChecklists);
  const [leavePersons, setLeavePersons] = useState<LeavePersonItem[]>(initialLeavePersons);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>(initialEvaluations);

  // Modals state
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [selectedMonthData, setSelectedMonthData] = useState<MonthlyHireLeaverData | null>(null);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedEvalItem, setSelectedEvalItem] = useState<EvaluationItem | null>(null);
  const [isEvalModalOpen, setIsEvalModalOpen] = useState(false);
  const [drilldownCategory, setDrilldownCategory] = useState<string>('현장직');
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  // Handlers
  const handleAddEvent = (newEvent: CalendarEventItem) => {
    setCalendarEvents((prev) => [newEvent, ...prev]);
  };

  const handleUpdateEvent = (updatedEvent: CalendarEventItem) => {
    setCalendarEvents((prev) =>
      prev.map((item) => (item.id === updatedEvent.id ? updatedEvent : item))
    );
  };

  const handleDeleteEvent = (eventId: string) => {
    setCalendarEvents((prev) => prev.filter((item) => item.id !== eventId));
  };

  const handleToggleChecklist = (id: string) => {
    setChecklists((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleAddChecklist = (newItem: DailyChecklistItem) => {
    setChecklists((prev) => [newItem, ...prev]);
  };

  const handleSyncDB = () => {
    alert(
      `인사 DB 연동 완료: ${dataInfo.fileName} 기준 ${dataInfo.rowCount}명의 입·퇴사일과 수습평가일이 캘린더에 반영되어 있습니다.`
    );
  };

  const handleUpdateLeaveStatus = (id: string, newStatus: LeavePersonItem['status']) => {
    setLeavePersons((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const handleOpenEvalModal = (item: EvaluationItem) => {
    setSelectedEvalItem(item);
    setIsEvalModalOpen(true);
  };

  const handleUpdateEvalStatus = (
    id: string,
    status: EvaluationItem['status'],
    grade?: EvaluationItem['finalGrade'],
    feedback?: string
  ) => {
    setEvaluations((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              finalGrade: grade || item.finalGrade,
              feedbackSummary: feedback || item.feedbackSummary,
              submittedDate: status === '완료' ? new Date().toISOString().slice(0, 10) : item.submittedDate,
            }
          : item
      )
    );
  };

  const handleOpenMonthModal = (data: MonthlyHireLeaverData) => {
    setSelectedMonthData(data);
    setIsMonthModalOpen(true);
  };

  const handleOpenDrilldown = (cat: string) => {
    setDrilldownCategory(cat);
    setIsDrilldownOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeMenu={activeMenu}
        onSelectMenu={(menu) => setActiveMenu(menu)}
        selectedCorp={selectedCorp}
        onChangeCorp={(corp) => setSelectedCorp(corp)}
        user={user}
        dataInfo={dataInfo}
        corps={corps}
        sbStatus={sbStatus}
        onLogout={onLogout}
        onOpenDataSource={onOpenDataSource}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 2xl:px-10 py-6">
        {activeMenu === '대시보드' && (
          <DashboardOverview
            kpiData={kpiData}
            monthlyData={monthlyData}
            matrixRows={matrixRows}
            calendarEvents={calendarEvents}
            onSelectMonthModal={handleOpenMonthModal}
            onOpenAddSchedule={() => setIsAddScheduleOpen(true)}
            selectedCorp={selectedCorp}
          />
        )}

        {activeMenu === '인력현황' && (
          <HeadcountAnalysis
            totalEmployees={kpiData.totalEmployees}
            monthlyData={monthlyData}
            leavePersons={leavePersons}
            onOpenDrilldown={handleOpenDrilldown}
            onOpenMonthModal={handleOpenMonthModal}
            onUpdateLeaveStatus={handleUpdateLeaveStatus}
          />
        )}

        {activeMenu === '인건비' && (
          <>
            <SampleDataNotice
              title="인건비 화면은 샘플 데이터입니다"
              reason={SAMPLE_ONLY.인건비.reason}
              missing={[...SAMPLE_ONLY.인건비.missing]}
            />
            <PayrollAnalysis />
          </>
        )}

        {activeMenu === '휴직자관리' && (
          <>
            <SampleDataNotice
              title="휴직 데이터가 없습니다"
              reason={SAMPLE_ONLY.휴직자관리.reason}
              missing={[...SAMPLE_ONLY.휴직자관리.missing]}
            />
            <LeaveManagement
              leavePersons={leavePersons}
              onUpdateLeaveStatus={handleUpdateLeaveStatus}
            />
          </>
        )}

        {activeMenu === '캘린더' && (
          <HRCalendarView
            events={calendarEvents}
            checklists={checklists}
            onOpenAddSchedule={() => setIsAddScheduleOpen(true)}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onToggleChecklist={handleToggleChecklist}
            onAddChecklist={handleAddChecklist}
            onSyncDB={handleSyncDB}
          />
        )}

        {activeMenu === '교육관리' && (
          <>
            <SampleDataNotice
              title="교육 관리 화면은 샘플 데이터입니다"
              reason={SAMPLE_ONLY.교육관리.reason}
              missing={[...SAMPLE_ONLY.교육관리.missing]}
            />
            <TrainingManagement />
          </>
        )}

        {activeMenu === '평가관리' && (
          <EvaluationManagement
            evaluations={evaluations}
            onOpenEvalModal={handleOpenEvalModal}
            onUpdateEvalStatus={handleUpdateEvalStatus}
          />
        )}
      </main>

      {/* Sleek Footer */}
      <footer className="h-10 bg-white border-t border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0 text-[11px] text-slate-400 mt-auto">
        <p className="truncate">© 2026 통합 사내 HR 인사정보 시스템 (STEK &amp; TBS).</p>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-blue-600 font-bold">시스템 상태: 정상</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="hidden sm:inline text-slate-400">시스템 버전 v2.4.1</span>
        </div>
      </footer>

      {/* Global Modals */}
      <AddScheduleModal
        isOpen={isAddScheduleOpen}
        onClose={() => setIsAddScheduleOpen(false)}
        onAddEvent={handleAddEvent}
      />

      <MonthDetailModal
        monthData={selectedMonthData}
        isOpen={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
      />

      <EvaluationDetailModal
        item={selectedEvalItem}
        isOpen={isEvalModalOpen}
        onClose={() => setIsEvalModalOpen(false)}
        onUpdateStatus={handleUpdateEvalStatus}
      />

      <DrilldownModal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        selectedCategory={drilldownCategory}
      />
    </div>
  );
}
