/**
 * 화면이 소비하는 데이터.
 * 기본값은 데모(샘플) 값이고, 엑셀을 업로드하면 applyExcelDataset() 이
 * 파생 가능한 항목만 실제 데이터로 교체한다. 컴포넌트는 수정하지 않는다.
 */
import {
  KPIData,
  RatioData,
  MonthlyHireLeaverData,
  DetailedMatrixRow,
  CalendarEventItem,
  DailyChecklistItem,
  LeavePersonItem,
  PayrollMonthlyData,
  DepartmentProductivityData,
  TrainingCourseItem,
  TrainingParticipant,
  EvaluationItem,
} from './types';

export let initialKPIData: KPIData = {
  totalEmployees: 648,
  newHiresThisMonth: 14,
  leaversThisMonth: 4,
  leaveOfAbsenceCount: 18,
  totalTO: 680,
  fillRate: 95.3,
  prevMonthDiff: {
    total: 10,
    newHires: 3,
    leavers: -2,
    leave: 1,
  },
};

export let genderRatioData: RatioData[] = [
  { name: '남성', value: 412, color: '#3b82f6', percentage: 64 },
  { name: '여성', value: 236, color: '#ec4899', percentage: 36 },
];

export let nationalityRatioData: RatioData[] = [
  { name: '내국인', value: 621, color: '#0284c7', percentage: 96 },
  { name: '외국인', value: 27, color: '#f59e0b', percentage: 4 },
];

export let jobTypeRatioData: RatioData[] = [
  { name: '사무직', value: 382, color: '#6366f1', percentage: 59 },
  { name: '현장직', value: 266, color: '#10b981', percentage: 41 },
];

export let ageRatioData: RatioData[] = [
  { name: '20대 이하', value: 142, color: '#06b6d4', percentage: 22 },
  { name: '30대', value: 286, color: '#3b82f6', percentage: 44 },
  { name: '40대', value: 158, color: '#8b5cf6', percentage: 24 },
  { name: '50대 이상', value: 62, color: '#64748b', percentage: 10 },
];

export let positionDistributionData = [
  { name: '사원', count: 210, percentage: 32, color: '#60a5fa' },
  { name: '선임', count: 228, percentage: 35, color: '#3b82f6' },
  { name: '프로', count: 168, percentage: 26, color: '#2563eb' },
  { name: '임원', count: 42, percentage: 7, color: '#1d4ed8' },
];

export let departmentDistributionData = [
  { name: '생산본부', count: 184, percentage: 28, fillRate: 95 },
  { name: '연구개발본부', count: 164, percentage: 25, fillRate: 98 },
  { name: '영업마케팅본부', count: 112, percentage: 17, fillRate: 93 },
  { name: '물류운영팀', count: 82, percentage: 13, fillRate: 96 },
  { name: '경영지원본부', count: 64, percentage: 10, fillRate: 98 },
  { name: '품질보증팀', count: 42, percentage: 7, fillRate: 93 },
];

export let monthlyHireLeaverData: MonthlyHireLeaverData[] = [
  { month: '1월', currentYearHires: 18, currentYearLeavers: 5, prevYearHires: 14, prevYearLeavers: 6, netChange: 13, highlightNote: '상반기 공채 1차 입사' },
  { month: '2월', currentYearHires: 12, currentYearLeavers: 3, prevYearHires: 10, prevYearLeavers: 4, netChange: 9 },
  { month: '3월', currentYearHires: 26, currentYearLeavers: 6, prevYearHires: 22, prevYearLeavers: 7, netChange: 20, highlightNote: '공채 신입 및 경력 대규모 입사 (연중 최고 피크)' },
  { month: '4월', currentYearHires: 10, currentYearLeavers: 4, prevYearHires: 9, prevYearLeavers: 5, netChange: 6 },
  { month: '5월', currentYearHires: 11, currentYearLeavers: 3, prevYearHires: 8, prevYearLeavers: 4, netChange: 8 },
  { month: '6월', currentYearHires: 15, currentYearLeavers: 7, prevYearHires: 12, prevYearLeavers: 6, netChange: 8, highlightNote: '상반기 결산 직무 재배치 및 퇴사' },
  { month: '7월', currentYearHires: 16, currentYearLeavers: 5, prevYearHires: 13, prevYearLeavers: 5, netChange: 11 },
  { month: '8월 (당월)', currentYearHires: 14, currentYearLeavers: 4, prevYearHires: 11, prevYearLeavers: 5, netChange: 10, highlightNote: '인턴 수료자 정규직 전환' },
  { month: '9월 (예상)', currentYearHires: 15, currentYearLeavers: 4, prevYearHires: 12, prevYearLeavers: 4, netChange: 11 },
  { month: '10월 (예상)', currentYearHires: 18, currentYearLeavers: 3, prevYearHires: 15, prevYearLeavers: 3, netChange: 15, highlightNote: '하반기 수시채용 대규모 증원' },
  { month: '11월 (예상)', currentYearHires: 8, currentYearLeavers: 4, prevYearHires: 7, prevYearLeavers: 5, netChange: 4 },
  { month: '12월 (예상)', currentYearHires: 6, currentYearLeavers: 9, prevYearHires: 5, prevYearLeavers: 11, netChange: -3, highlightNote: '연말 정년퇴직 및 이직 피크' },
];

export let detailedMatrixRows: DetailedMatrixRow[] = [
  { id: '1', corporation: 'STEK', location: '서울 본사', maleCount: 145, femaleCount: 98, domesticCount: 238, foreignCount: 5, leaveCount: 7, totalCount: 243 },
  { id: '2', corporation: 'STEK', location: '천안 사업장', maleCount: 158, femaleCount: 54, domesticCount: 198, foreignCount: 14, leaveCount: 5, totalCount: 212 },
  { id: '3', corporation: 'TBS', location: '서울 본사', maleCount: 48, femaleCount: 52, domesticCount: 96, foreignCount: 4, leaveCount: 3, totalCount: 100 },
  { id: '4', corporation: 'TBS', location: '천안 사업장', maleCount: 61, femaleCount: 32, domesticCount: 89, foreignCount: 4, leaveCount: 3, totalCount: 93 },
];

export let tenureByDepartment = [
  { department: '생산본부', avgYears: 6.1, earlyTurnoverRate: 3.2 },
  { department: '연구개발본부', avgYears: 5.2, earlyTurnoverRate: 4.1 },
  { department: '경영지원본부', avgYears: 4.8, earlyTurnoverRate: 2.5 },
  { department: '품질보증팀', avgYears: 4.3, earlyTurnoverRate: 3.8 },
  { department: '물류운영팀', avgYears: 3.9, earlyTurnoverRate: 5.4 },
  { department: '영업마케팅본부', avgYears: 2.4, earlyTurnoverRate: 14.8 }, // Focus of analysis
];

export let salesCohortTurnoverData = [
  { period: '입사 3개월 이내', turnoverRate: 6.8, mainReason: '현장 영업 강도 및 KPI 부담' },
  { period: '입사 6개월 이내', turnoverRate: 11.4, mainReason: '거래처 인수인계 및 목표 미달' },
  { period: '입사 1년 이내', turnoverRate: 14.8, mainReason: '타사 헤드헌팅 및 보상 격차' },
  { period: '입사 2년 이상', turnoverRate: 4.2, mainReason: '핵심 인재 정착 단계' },
];

export let fieldWorkDrilldown = {
  total: 266,
  categories: [
    {
      id: 'prod',
      name: '생산직',
      totalCount: 184,
      teams: [
        { teamName: '생산1팀 (반도체 소재)', count: 72, leader: '박동훈 책임', shift: '3조 2교대' },
        { teamName: '생산2팀 (광학 필름)', count: 68, leader: '이성민 수석', shift: '3조 2교대' },
        { teamName: '공정조립반', count: 44, leader: '최명진 반장', shift: '주간 고정' },
      ],
      recentTrend: '+6명 증원 (천안 2라인 증설)',
    },
    {
      id: 'logistics',
      name: '물류직',
      totalCount: 82,
      teams: [
        { teamName: '원자재 입출고팀', count: 42, leader: '정태우 과장', shift: '주간/심야 교대' },
        { teamName: '물류운영 및 배송관리팀', count: 40, leader: '김영식 차장', shift: '주간 고정' },
      ],
      recentTrend: '+2명 충원 (배송센터 통합)',
    },
  ],
};

export let initialLeavePersons: LeavePersonItem[] = [
  { id: 'LV-01', name: '김서연', department: '연구개발본부', position: '선임연구원', reason: '육아휴직', startDate: '2025-11-01', expectedReturnDate: '2026-10-31', dDay: 75, substituteAssigned: true, substituteName: '이주호 (계약직 대체)', contact: '010-3491-9281', status: '휴직중' },
  { id: 'LV-02', name: '이지은', department: '경영지원본부', position: '프로', reason: '육아휴직', startDate: '2025-09-15', expectedReturnDate: '2026-09-14', dDay: 28, substituteAssigned: true, substituteName: '한수진 선임', contact: '010-8291-1029', status: '복직예정' },
  { id: 'LV-03', name: '박준혁', department: '생산본부 (생산1팀)', position: '선임', reason: '질병휴직', startDate: '2026-03-01', expectedReturnDate: '2026-08-31', dDay: 14, substituteAssigned: true, substituteName: '강태규 사원', contact: '010-5512-8831', status: '복직예정' },
  { id: 'LV-04', name: '최윤아', department: '영업마케팅본부', position: '사원', reason: '육아휴직', startDate: '2026-02-01', expectedReturnDate: '2027-01-31', dDay: 167, substituteAssigned: false, contact: '010-9941-2311', status: '휴직중' },
  { id: 'LV-05', name: '정민호', department: '품질보증팀', position: '선임', reason: '학업휴직', startDate: '2026-01-01', expectedReturnDate: '2026-12-31', dDay: 136, substituteAssigned: true, substituteName: '오성택 선임', contact: '010-4491-0021', status: '휴직중' },
  { id: 'LV-06', name: '송혜원', department: '물류운영팀', position: '사원', reason: '가족돌봄휴직', startDate: '2026-05-15', expectedReturnDate: '2026-09-30', dDay: 44, substituteAssigned: true, substituteName: '배영찬 사원', contact: '010-7718-4920', status: '휴직중' },
  { id: 'LV-07', name: '임태양', department: '연구개발본부', position: '프로', reason: '질병휴직', startDate: '2026-06-01', expectedReturnDate: '2026-11-30', dDay: 105, substituteAssigned: true, substituteName: '유진우 프로', contact: '010-2391-4401', status: '휴직중' },
];

export let initialPayrollData: PayrollMonthlyData[] = [
  { month: '1월', currentYearAmount: 32.4, prevYearAmount: 29.8, baseSalary: 23.2, bonusAmount: 2.1, allowance: 2.8, insuranceSocial: 2.3, employerContribution: 2.0, newHireImpact: 0.6 },
  { month: '2월', currentYearAmount: 32.8, prevYearAmount: 30.1, baseSalary: 23.5, bonusAmount: 2.0, allowance: 2.9, insuranceSocial: 2.4, employerContribution: 2.0, newHireImpact: 0.8 },
  { month: '3월', currentYearAmount: 34.5, prevYearAmount: 31.0, baseSalary: 24.2, bonusAmount: 2.5, allowance: 3.1, insuranceSocial: 2.6, employerContribution: 2.1, newHireImpact: 1.4, note: '상반기 대규모 신규 입사자 급여 반영' },
  { month: '4월', currentYearAmount: 34.8, prevYearAmount: 31.4, baseSalary: 24.5, bonusAmount: 2.2, allowance: 3.2, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.5 },
  { month: '5월', currentYearAmount: 35.1, prevYearAmount: 31.8, baseSalary: 24.7, bonusAmount: 2.3, allowance: 3.2, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.6 },
  { month: '6월', currentYearAmount: 35.6, prevYearAmount: 32.2, baseSalary: 25.0, bonusAmount: 2.4, allowance: 3.3, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.8 },
  { month: '7월', currentYearAmount: 36.2, prevYearAmount: 32.5, baseSalary: 25.3, bonusAmount: 2.5, allowance: 3.4, insuranceSocial: 2.8, employerContribution: 2.2, newHireImpact: 2.0 },
  { month: '8월 (당월)', currentYearAmount: 36.8, prevYearAmount: 32.9, baseSalary: 25.6, bonusAmount: 2.6, allowance: 3.5, insuranceSocial: 2.8, employerContribution: 2.3, newHireImpact: 2.2 },
  { month: '9월 (예상)', currentYearAmount: 37.1, prevYearAmount: 33.2, baseSalary: 25.8, bonusAmount: 2.6, allowance: 3.5, insuranceSocial: 2.9, employerContribution: 2.3, newHireImpact: 2.4 },
  { month: '10월 (예상)', currentYearAmount: 46.8, prevYearAmount: 41.5, baseSalary: 26.2, bonusAmount: 11.8, allowance: 3.6, insuranceSocial: 2.9, employerContribution: 2.3, newHireImpact: 2.7, isBonusPeak: true, note: '추석 명절 상여금 및 하반기 경영성과급 지급 스파이크' },
  { month: '11월 (예상)', currentYearAmount: 37.5, prevYearAmount: 33.6, baseSalary: 26.3, bonusAmount: 2.7, allowance: 3.6, insuranceSocial: 2.6, employerContribution: 2.3, newHireImpact: 2.8 },
  { month: '12월 (예상)', currentYearAmount: 43.2, prevYearAmount: 38.9, baseSalary: 26.5, bonusAmount: 8.2, allowance: 3.6, insuranceSocial: 2.6, employerContribution: 2.3, newHireImpact: 2.9, note: '연말 특별 인센티브 및 결산 수당' },
];

export let departmentProductivityData: DepartmentProductivityData[] = [
  { id: '1', department: '연구개발본부', headcount: 164, annualPayroll: 128.4, monthlyPayrollAvg: 1070, generatedRevenue: 890.0, kpiScore: 96.4, productivityPerPerson: 5.43, payrollRoi: 6.93 },
  { id: '2', department: '생산본부', headcount: 184, annualPayroll: 119.6, monthlyPayrollAvg: 996, generatedRevenue: 1240.0, kpiScore: 94.8, productivityPerPerson: 6.74, payrollRoi: 10.37 },
  { id: '3', department: '영업마케팅본부', headcount: 112, annualPayroll: 89.2, monthlyPayrollAvg: 743, generatedRevenue: 1420.0, kpiScore: 92.1, productivityPerPerson: 12.68, payrollRoi: 15.92 },
  { id: '4', department: '물류운영팀', headcount: 82, annualPayroll: 45.8, monthlyPayrollAvg: 381, generatedRevenue: 280.0, kpiScore: 95.0, productivityPerPerson: 3.41, payrollRoi: 6.11 },
  { id: '5', department: '경영지원본부', headcount: 64, annualPayroll: 42.6, monthlyPayrollAvg: 355, generatedRevenue: 190.0, kpiScore: 98.2, productivityPerPerson: 2.97, payrollRoi: 4.46 },
  { id: '6', department: '품질보증팀', headcount: 42, annualPayroll: 28.4, monthlyPayrollAvg: 236, generatedRevenue: 210.0, kpiScore: 93.7, productivityPerPerson: 5.00, payrollRoi: 7.39 },
];

export let payrollCostBreakdown = [
  { name: '기본급', value: 68.2, color: '#2563eb' },
  { name: '상여금 및 인센티브', value: 14.5, color: '#f59e0b' },
  { name: '법정 제수당 (연장/야간)', value: 8.8, color: '#10b981' },
  { name: '4대 사회보험 (회사부담)', value: 5.4, color: '#8b5cf6' },
  { name: '퇴직급여충당금 및 복리후생', value: 3.1, color: '#ec4899' },
];

export let initialCalendarEvents: CalendarEventItem[] = [
  // 1. 전사HR: 행사(워크샵, 패밀리데이), 공식회의일정
  { id: 'EV-01', title: '2026년 정기 진급식', date: '2026-08-07', startDate: '2026-08-07', endDate: '2026-08-07', time: '10:00', category: '전사HR', location: '서울', source: '인사DB연동', description: '전사 정기 승진 및 임명장 수여식' },
  { id: 'EV-02', title: '8월 전사 패밀리데이 (조기퇴근)', date: '2026-08-14', startDate: '2026-08-14', endDate: '2026-08-14', time: '16:00', category: '전사HR', location: '서울', source: '수동등록', description: '가족 친화의 날 16시 조기 퇴근 시행' },
  { id: 'EV-03', title: '경영전략 월간 확대 공식회의', date: '2026-08-18', startDate: '2026-08-18', endDate: '2026-08-18', time: '10:30', category: '전사HR', location: '서울', source: '수동등록', description: '8월 실적 점검 및 9월 핵심 목표 수립' },
  { id: 'EV-04', title: '하반기 전사 조직문화 워크샵', date: '2026-08-27', startDate: '2026-08-27', endDate: '2026-08-28', time: '13:00', category: '전사HR', location: '천안', source: '수동등록', description: '비전 공유 및 팀 빌딩 액티비티' },

  // 2. 입사자
  { id: 'EV-05', title: '경영관리팀 김사원 신규 입사', date: '2026-08-01', startDate: '2026-08-01', endDate: '2026-08-01', time: '09:00', category: '입사자', location: '서울', source: '인사DB연동', description: '신규 입사 및 OJT 진행' },
  { id: 'EV-07', title: '기술연구소 이선임 경력 입사', date: '2026-08-18', startDate: '2026-08-18', endDate: '2026-08-18', time: '09:00', category: '입사자', location: '천안', source: '인사DB연동', description: '경력직 온보딩 및 사원증 발급' },

  // 3. 퇴사자
  { id: 'EV-06', title: '영업팀 김선임 퇴사', date: '2026-08-08', startDate: '2026-08-08', endDate: '2026-08-08', time: '18:00', category: '퇴사자', location: '서울', source: '인사DB연동', description: '퇴직 절차 및 업무 인수인계' },
  { id: 'EV-08', title: '생산본부 박프로 퇴직 및 인수인계', date: '2026-08-25', startDate: '2026-08-25', endDate: '2026-08-25', time: '18:00', category: '퇴사자', location: '천안', source: '인사DB연동', description: '퇴직 서류 교부 및 보안 회수' },

  // 4. 수습평가: 1차 수습평가, 최종 수습평가
  { id: 'EV-09', title: '마케팅팀 김프로 1차 수습평가일', date: '2026-08-10', startDate: '2026-08-10', endDate: '2026-08-10', time: '14:00', category: '1차 수습평가', location: '서울', source: '인사DB연동', description: '1개월 차 직무 적응도 및 1차 수습평가 심의' },
  { id: 'EV-10', title: '솔루션팀 김사원 최종 수습평가 심의', date: '2026-08-12', startDate: '2026-08-12', endDate: '2026-08-13', time: '15:00', category: '최종 수습평가', location: '서울', source: '인사DB연동', description: '3개월 차 정규직 전환 최종 수습 심의 위원회' },
  { id: 'EV-11', title: '영업기획팀 정사원 1차 수습평가일', date: '2026-08-21', startDate: '2026-08-21', endDate: '2026-08-21', time: '11:00', category: '1차 수습평가', location: '서울', source: '인사DB연동', description: '1차 수습 부서장 면담 및 평가표 접수' },

  // 5. 평가: 역량평가, 성과평가
  { id: 'EV-12', title: '하반기 전사 직무 역량평가 기간', date: '2026-08-17', startDate: '2026-08-17', endDate: '2026-08-21', time: '14:00', category: '평가', location: '서울', source: '인사DB연동', description: '2026년 하반기 역량평가 시스템 오픈 및 자기/부서장 평가' },
  { id: 'EV-13', title: '3분기 핵심 성과평가(KPI) 리뷰 기간', date: '2026-08-24', startDate: '2026-08-24', endDate: '2026-08-28', time: '09:00', category: '평가', location: '천안', source: '수동등록', description: '3분기 조직/개인 KPI 달성률 중간 점검 및 피드백' },
  { id: 'EV-14', title: '2026년도 사업목표 중간 성과평가 마감', date: '2026-08-31', startDate: '2026-08-31', endDate: '2026-08-31', time: '18:00', category: '평가', location: '서울', source: '수동등록', description: '상반기 성과평가 지표 취합 및 부서별 결과 확정 마감' },
];

export let initialChecklists: DailyChecklistItem[] = [
  { id: 'CK-01', title: '신규 입사자 4명 사내 인프라 권한 및 복지카드 신청 승인', category: '일일업무', dueDate: '2026-08-18', completed: true, priority: '높음', assignee: '김인사 매니저' },
  { id: 'CK-02', title: '1차 수습평가 대상자(김태윤) 부서장 평가표 제출 여부 독려', category: '일일업무', dueDate: '2026-08-18', completed: false, priority: '높음', assignee: '이평가 책임' },
  { id: 'CK-03', title: '8월 정기 급여 변동분(야간근로/신규입사/휴직) 대조 검증', category: '일일업무', dueDate: '2026-08-19', completed: false, priority: '높음', assignee: '박급여 프로' },
  { id: 'CK-04', title: '법정의무교육 미수료자 42명 대상 2차 사내 메신저 알림 발송', category: '주간업무', dueDate: '2026-08-21', completed: false, priority: '보통', assignee: '정교육 선임' },
  { id: 'CK-05', title: '천안 사업장 3조 2교대 근로자 야간수당 실적 취합 및 승인', category: '주간업무', dueDate: '2026-08-22', completed: true, priority: '보통', assignee: '최노무 차장' },
  { id: 'CK-06', title: '복직 예정자(이지은, 박준혁) 복직 부서 배치계획 수립', category: '월간업무', dueDate: '2026-08-28', completed: false, priority: '높음', assignee: '김인사 매니저' },
  { id: 'CK-07', title: '9월 채용 박람회 부스 참가 기안 및 홍보물 발주', category: '월간업무', dueDate: '2026-08-30', completed: false, priority: '낮음', assignee: '한채용 프로' },
];

export let initialTrainingCourses: TrainingCourseItem[] = [
  { id: 'TR-01', title: '2026년 개인정보보호 및 정보보안 실무', category: '법정의무교육', targetCount: 648, completedCount: 606, completionRate: 93.5, startDate: '2026-07-01', endDate: '2026-08-31', instructor: '한국인터넷진흥원 전문강사진', status: '진행중', mandatory: true },
  { id: 'TR-02', title: '직장 내 괴롭힘 및 성희롱 예방 교육', category: '법정의무교육', targetCount: 648, completedCount: 618, completionRate: 95.4, startDate: '2026-07-01', endDate: '2026-08-31', instructor: '고용노동부 지정 전문노무사', status: '진행중', mandatory: true },
  { id: 'TR-03', title: '제조 현장 산업안전보건 및 위험성평가', category: '법정의무교육', targetCount: 266, completedCount: 254, completionRate: 95.5, startDate: '2026-08-01', endDate: '2026-08-25', instructor: '안전보건공단 인증원', status: '진행중', mandatory: true },
  { id: 'TR-04', title: '팀장/파트장을 위한 성과 코칭 리더십 워크숍', category: '리더십교육', targetCount: 52, completedCount: 48, completionRate: 92.3, startDate: '2026-08-10', endDate: '2026-08-14', instructor: '외부 리더십 전문교수', status: '마감', mandatory: false },
  { id: 'TR-05', title: '2026 하반기 신규 입사자 입문 OJT', category: '신규입사자OJT', targetCount: 28, completedCount: 28, completionRate: 100.0, startDate: '2026-08-01', endDate: '2026-08-07', instructor: '사내 핵심 강사진', status: '마감', mandatory: true },
  { id: 'TR-06', title: '차세대 반도체 공정 설계 실무 심화', category: '직무전문교육', targetCount: 85, completedCount: 62, completionRate: 72.9, startDate: '2026-08-15', endDate: '2026-09-15', instructor: '서울대 반도체연구소', status: '진행중', mandatory: false },
];

export let initialTrainingParticipants: TrainingParticipant[] = [
  { id: 'TP-01', name: '강민우', department: '영업마케팅본부', position: '사원', courseTitle: '개인정보보호 및 정보보안 실무', status: '미수료' },
  { id: 'TP-02', name: '윤하은', department: '연구개발본부', position: '선임연구원', courseTitle: '개인정보보호 및 정보보안 실무', status: '미수료' },
  { id: 'TP-03', name: '송지훈', department: '생산본부 (생산2팀)', position: '선임', courseTitle: '제조 현장 산업안전보건 및 위험성평가', status: '미수료' },
  { id: 'TP-04', name: '배서현', department: '물류운영팀', position: '사원', courseTitle: '직장 내 괴롭힘 및 성희롱 예방 교육', status: '미수료' },
  { id: 'TP-05', name: '김태윤', department: '연구개발본부', position: '사원', courseTitle: '2026 하반기 신규 입사자 입문 OJT', status: '수료', completedDate: '2026-08-07', score: 98 },
  { id: 'TP-06', name: '서유진', department: '영업마케팅본부', position: '선임', courseTitle: '개인정보보호 및 정보보안 실무', status: '수료', completedDate: '2026-08-12', score: 94 },
  { id: 'TP-07', name: '문성호', department: '품질보증팀', position: '프로', courseTitle: '차세대 반도체 공정 설계 실무 심화', status: '진행중' },
  { id: 'TP-08', name: '박진서', department: '생산본부 (생산1팀)', position: '반장', courseTitle: '제조 현장 산업안전보건 및 위험성평가', status: '수료', completedDate: '2026-08-14', score: 100 },
];

export let initialEvaluations: EvaluationItem[] = [
  // 수습평가
  { id: 'EV-PR-01', type: '수습평가', targetName: '김태윤', department: '연구개발본부 R&D 1팀', position: '사원', evaluatorName: '정동진 팀장', evaluatorPosition: '수석연구원', stage: '1차 수습 (1개월)', status: '진행중', dueDate: '2026-08-19', selfScore: 92, managerScore: 88, feedbackSummary: '기본 직무 이해도와 연구 장비 운용 능력이 우수하며 동료 간 소통이 적극적임.' },
  { id: 'EV-PR-02', type: '수습평가', targetName: '서유진', department: '영업마케팅본부 국내영업', position: '선임', evaluatorName: '김광수 부장', evaluatorPosition: '영업본부장', stage: '최종 수습 (3개월)', status: '완료', dueDate: '2026-08-21', selfScore: 95, managerScore: 94, finalGrade: 'S', feedbackSummary: '담당 주요 거래처와의 신뢰 구축 및 3개월 만에 신규 매출 1.2억 달성으로 조기 정규직 강력 추천.', submittedDate: '2026-08-16' },
  { id: 'EV-PR-03', type: '수습평가', targetName: '박세영', department: '생산본부 생산2팀', position: '사원', evaluatorName: '이성민 팀장', evaluatorPosition: '수석', stage: '1차 수습 (1개월)', status: '미작성', dueDate: '2026-08-25' },
  { id: 'EV-PR-04', type: '수습평가', targetName: '조현우', department: '물류운영팀', position: '사원', evaluatorName: '김영식 차장', evaluatorPosition: '물류팀장', stage: '최종 수습 (3개월)', status: '진행중', dueDate: '2026-08-28', selfScore: 88, feedbackSummary: '물류 ERP 시스템 활용도 평가 진행 중.' },
  
  // 역량평가
  { id: 'EV-CP-01', type: '역량평가', targetName: '강태규', department: '생산본부 생산1팀', position: '선임', evaluatorName: '박동훈 책임', evaluatorPosition: '생산1팀장', stage: '상반기 역량', status: '완료', dueDate: '2026-07-30', selfScore: 89, managerScore: 91, finalGrade: 'A', feedbackSummary: '위기 대응 능력 및 공정 개선 아이디어 제시 우수.', submittedDate: '2026-07-28' },
  { id: 'EV-CP-02', type: '역량평가', targetName: '윤하은', department: '연구개발본부 신소재랩', position: '선임연구원', evaluatorName: '이진수 상무', evaluatorPosition: '연구소장', stage: '상반기 역량', status: '완료', dueDate: '2026-07-30', selfScore: 96, managerScore: 98, finalGrade: 'S', feedbackSummary: '차세대 코팅 신소재 특허 출원 2건 주도 및 뛰어난 전문 역량 발휘.', submittedDate: '2026-07-29' },
  { id: 'EV-CP-03', type: '역량평가', targetName: '오성택', department: '품질보증팀', position: '선임', evaluatorName: '문성호 프로', evaluatorPosition: '품질파트장', stage: '하반기 역량', status: '미작성', dueDate: '2026-11-30' },
  { id: 'EV-CP-04', type: '역량평가', targetName: '배영찬', department: '물류운영팀', position: '사원', evaluatorName: '정태우 과장', evaluatorPosition: '파트장', stage: '하반기 역량', status: '미작성', dueDate: '2026-11-30' },

  // 성과평가
  { id: 'EV-PF-01', type: '성과평가', targetName: '신재민', department: '영업마케팅본부 해외영업', position: '책임', evaluatorName: '김광수 부장', evaluatorPosition: '영업본부장', stage: '연간 성과 MBO', status: '진행중', dueDate: '2026-12-15', selfScore: 95, managerScore: 92, feedbackSummary: '북미 및 동남아 신규 바이어 발굴로 연간 수주 목표 112% 초과 달성 중.' },
  { id: 'EV-PF-02', type: '성과평가', targetName: '한수진', department: '경영지원본부 인사총무', position: '선임', evaluatorName: '장미라 이사', evaluatorPosition: '경영지원총괄', stage: '연간 성과 MBO', status: '진행중', dueDate: '2026-12-15', selfScore: 90, managerScore: 93, feedbackSummary: 'HR SaaS 시스템 도입 및 인사 프로세스 디지털 전환 프로젝트 주도.' },
  { id: 'EV-PF-03', type: '성과평가', targetName: '권오성', department: '연구개발본부 회로설계', position: '수석연구원', evaluatorName: '이진수 상무', evaluatorPosition: '연구소장', stage: '연간 성과 MBO', status: '완료', dueDate: '2026-08-10', selfScore: 98, managerScore: 97, finalGrade: 'S', feedbackSummary: '핵심 모듈 양산 성공으로 원가 18% 절감 기여.', submittedDate: '2026-08-08' },
  { id: 'EV-PF-04', type: '성과평가', targetName: '김현석', department: '생산본부 공정기술', position: '프로', evaluatorName: '박동훈 책임', evaluatorPosition: '생산1팀장', stage: '연간 성과 MBO', status: '미작성', dueDate: '2026-12-15' },
];


/* ============================================================
   엑셀 데이터 주입
   ============================================================ */
import type { Dataset, Origin } from './excel/adapt';

/* 엑셀에 원천 데이터가 없는 항목은 아래 샘플을 계속 사용한다 (데모 보완) */
const SAMPLE_EVALUATIONS: EvaluationItem[] = initialEvaluations;
const SAMPLE_LEAVE: LeavePersonItem[] = initialLeavePersons;

/** 임의 기준일로 인원을 다시 세기 위한 입·퇴사일 목록 (업로드 전에는 빈 배열) */
export let employeeRecords: { hireDate: string | null; quitDate: string | null }[] = [];

/** 재직자 고용형태 분해 (인력현황 보조 문구) */
export let employmentBreakdown = { regular: 632, contract: 16, leave: 18 };

/** 각 데이터의 출처. 업로드 전에는 전부 'sample'. */
export let dataOrigin: Record<string, Origin> = {};
/** 각 데이터의 산출 근거·한계 문장 */
export let dataNotes: Record<string, string> = {};
/** 엑셀에서 파생할 수 없어 샘플 값을 그대로 쓰는 화면 */
export const SAMPLE_ONLY = {
  인건비: {
    reason: '급여액·상여·사회보험료·부서 매출 데이터가 인사기초정보 엑셀에 없어 데모 샘플로 표시됩니다.',
    missing: ['급여액', '상여금', '수당', '4대보험', '부서별 매출', '정원(TO)'],
  },
  교육관리: {
    reason: '교육 과정·수료 이력 데이터가 인사기초정보 엑셀에 없어 데모 샘플로 표시됩니다.',
    missing: ['교육과정', '수료여부', '수료일', '평가점수'],
  },
  휴직자관리: {
    reason: '휴직 사유·시작일·복직예정일 컬럼이 인사기초정보 엑셀에 없어 표시할 휴직자가 없습니다.',
    missing: ['휴직사유', '휴직시작일', '복직예정일', '대체인력'],
  },
} as const;

/** 업로드된 엑셀에서 만든 데이터셋을 화면 데이터에 반영 */
export function applyExcelDataset(ds: Dataset): void {
  initialKPIData = ds.kpi;
  genderRatioData = ds.genderRatio;
  nationalityRatioData = ds.nationalityRatio;
  jobTypeRatioData = ds.jobTypeRatio;
  ageRatioData = ds.ageRatio;
  positionDistributionData = ds.positionDistribution;
  departmentDistributionData = ds.departmentDistribution;
  monthlyHireLeaverData = ds.monthly;
  detailedMatrixRows = ds.matrixRows;
  tenureByDepartment = ds.tenureByDept;
  fieldWorkDrilldown = ds.fieldWork;
  initialCalendarEvents = ds.calendarEvents;
  initialChecklists = ds.checklists;
  // 수습평가는 엑셀에서 생성하고, 역량·성과평가는 원천 데이터가 없어 샘플을 이어붙인다
  initialEvaluations = [
    ...ds.evaluations,
    ...SAMPLE_EVALUATIONS.filter((e) => e.type !== '수습평가'),
  ];
  // 휴직 컬럼이 엑셀에 없어 휴직자 목록은 샘플을 유지하고 KPI 를 그 수치와 맞춘다
  initialLeavePersons = SAMPLE_LEAVE;
  const onLeave = SAMPLE_LEAVE.filter((p) => p.status !== '복직완료').length;
  initialKPIData = { ...ds.kpi, leaveOfAbsenceCount: onLeave };
  employeeRecords = ds.records;
  employmentBreakdown = ds.employmentBreakdown;
  // 아래는 엑셀에 원천 데이터가 없어 샘플 유지:
  //   initialPayrollData / departmentProductivityData / payrollCostBreakdown
  //   initialTrainingCourses / initialTrainingParticipants / salesCohortTurnoverData
  dataOrigin = ds.origin;
  dataNotes = ds.notes;
}
