export type ActiveMenu =
  | '대시보드'
  | '인력현황'
  | '직원명부'
  | '구성다양성'
  | '조직도'
  | '인건비'
  | '발령이력'
  | '휴직자관리'
  | '캘린더'
  | '데이터품질'
  | '증명서'
  | '메일발송'
  | '교육관리'
  | '평가관리'
  | '감사로그'
  | '계정관리'
  | '설정';

export type HeadcountSubTab = '상세분석' | '입퇴사' | '인력구성비' | '휴직';

export type EvaluationSubTab = '수습평가' | '역량평가' | '성과평가';

export interface KPIData {
  totalEmployees: number;
  newHiresThisMonth: number;
  leaversThisMonth: number;
  leaveOfAbsenceCount: number;
  totalTO: number;
  fillRate: number;
  prevMonthDiff: {
    total: number;
    newHires: number;
    leavers: number;
    leave: number;
  };
}

export interface RatioData {
  name: string;
  value: number;
  color?: string;
  percentage?: number;
}

export interface MonthlyHireLeaverData {
  month: string;
  currentYearHires: number;
  currentYearLeavers: number;
  prevYearHires: number;
  prevYearLeavers: number;
  netChange: number;
  highlightNote?: string;
}

export interface DetailedMatrixRow {
  id: string;
  corporation: string;
  location: string;
  maleCount: number;
  femaleCount: number;
  domesticCount: number;
  foreignCount: number;
  leaveCount: number;
  totalCount: number;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  date: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  category: '전사HR' | '입사자' | '퇴사자' | '1차 수습평가' | '최종 수습평가' | '수습평가' | '평가' | '입/퇴사자' | '입사' | '퇴사' | '1차 수습평가일' | '최종 수습평가일' | '1차수습평가' | '최종수습평가' | '교육' | '인사일반' | '급여' | string;
  location?: '서울' | '천안' | string;
  targetPerson?: string;
  department?: string;
  source: '인사DB연동' | '수동등록';
  description?: string;
  completed?: boolean;
}

export interface DailyChecklistItem {
  id: string;
  title: string;
  category: '일일업무' | '주간업무' | '월간업무';
  dueDate: string;
  completed: boolean;
  priority: '높음' | '보통' | '낮음';
  assignee: string;
}

export interface LeavePersonItem {
  id: string;
  name: string;
  department: string;
  position: string;
  reason: '육아휴직' | '질병휴직' | '가족돌봄휴직' | '학업휴직' | '기타휴직';
  startDate: string;
  expectedReturnDate: string;
  dDay: number;
  substituteAssigned: boolean;
  substituteName?: string;
  contact: string;
  status: '휴직중' | '복직예정' | '복직완료';
}

export interface PayrollMonthlyData {
  month: string;
  currentYearAmount: number; // 억원 단위
  prevYearAmount: number;
  baseSalary: number;
  bonusAmount: number;
  allowance: number;
  insuranceSocial: number;
  employerContribution: number;
  newHireImpact: number;
  note?: string;
  isBonusPeak?: boolean;
}

export interface DepartmentProductivityData {
  id: string;
  department: string;
  headcount: number;
  annualPayroll: number; // 억원
  monthlyPayrollAvg: number; // 천만원
  generatedRevenue: number; // 억원
  kpiScore: number; // 100점 만점
  productivityPerPerson: number; // 1인당 매출 기여 (억원)
  payrollRoi: number; // 인건비 대비 매출 배수
}

export interface TrainingCourseItem {
  id: string;
  title: string;
  category: '법정의무교육' | '직무전문교육' | '리더십교육' | '신규입사자OJT';
  targetCount: number;
  completedCount: number;
  completionRate: number;
  startDate: string;
  endDate: string;
  instructor: string;
  status: '진행중' | '모집중' | '마감' | '상시';
  mandatory: boolean;
}

export interface TrainingParticipant {
  id: string;
  name: string;
  department: string;
  position: string;
  courseTitle: string;
  status: '수료' | '미수료' | '진행중';
  completedDate?: string;
  score?: number;
}

export interface EvaluationItem {
  id: string;
  type: '수습평가' | '역량평가' | '성과평가';
  targetName: string;
  department: string;
  position: string;
  evaluatorName: string;
  evaluatorPosition: string;
  stage: '1차 수습 (1개월)' | '최종 수습 (3개월)' | '상반기 역량' | '하반기 역량' | '연간 성과 MBO';
  status: '진행중' | '완료' | '미작성';
  dueDate: string;
  selfScore?: number;
  managerScore?: number;
  finalGrade?: 'S' | 'A' | 'B' | 'C' | 'D';
  feedbackSummary?: string;
  submittedDate?: string;
}
