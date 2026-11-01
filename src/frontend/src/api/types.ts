// Kiểu dữ liệu trả về từ backend (khớp với các service NestJS).

export type Role = 'ADMIN' | 'LECTURER' | 'STUDENT' | 'PARENT' | 'ENTERPRISE';
export type WorkMode = 'INDIVIDUAL' | 'GROUP';
export type ProductType = 'IMAGE' | 'FIGMA' | 'VIDEO' | 'SOURCE' | 'GIT_LINK' | 'REPORT';
export type AssignmentStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type Phase = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'ENDED' | 'PUBLISHED';
export type MyStatus = 'NOT_OPEN' | 'NO_GROUP' | 'NO_TOPIC' | 'NOT_SUBMITTED' | 'SUBMITTED' | 'LATE' | 'MISSED' | 'GRADED';
export type SyncStatus = 'PENDING' | 'UPLOADING' | 'SYNCED' | 'FAILED' | 'MISSING' | 'ERROR';

export interface AuthUser {
  sub: string;
  role: Role;
  name: string;
  lecturerId?: string;
  studentId?: string;
  code?: string;
  /** SV: đã khai báo hồ sơ (FR-03.01) */
  profileCompleted?: boolean;
  hasAvatar?: boolean;
  avatarVersion?: number;
  /** chưa đổi mật khẩu lần đầu */
  mcp?: boolean;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface Semester {
  code: string;
  academicYear: string;
  term: string;
  isCurrent: boolean;
  startDate?: string;
  endDate: string;
}

// ================================================================ Giảng viên

export interface AssignmentStats {
  students: number;
  expected: number;
  submitted: number;
  groups: number;
  topics: number;
  graded: number;
  openReports: number;
}

export interface AssignmentSummary {
  id: string;
  title: string;
  workMode: WorkMode;
  hasIndividualPart: boolean;
  status: AssignmentStatus;
  autoOpen: boolean;
  openAt: string;
  dueAt: string;
  finalDeadline: string;
  batchId: string | null;
  weight: number;
  groupsImportedAt: string | null;
  gradesPublishedAt: string | null;
  avgScore: number | null;
  stats: AssignmentStats;
  phase: Phase;
}

export interface LecturerSection {
  id: string;
  code: string;
  schedule: string | null;
  course: { code: string; name: string; type: string; credits: number };
  semester: Semester;
  studentCount: number;
  assignmentCount: number;
  openAssignmentCount: number;
  submissionCount: number;
  onTimeRate: number | null;
}

export interface SectionStudentRow {
  id: string;
  studentCode: string;
  fullName: string;
  cohort: string | null;
  group: { seq: number; code: string; name: string; isLeader: boolean } | null;
  neverLoggedIn: boolean;
  topic: string | null;
  submitted: number;
  avgScore: number | null;
  profileCompleted: boolean;
}

export interface SectionGroupRow {
  id: string;
  seq: number;
  code: string;
  name: string;
  assignment: { id: string; title: string };
  members: { studentCode: string; fullName: string; role: string }[];
  topic: { title: string; keywords: string[] } | null;
  submission: { status: string; isLate: boolean; submittedAt: string } | null;
}

export interface UnitSubmission {
  id: string;
  submittedAt: string;
  submittedBy: string;
  submittedByCode: string;
  isLate: boolean;
  lateDays: number;
  syncStatus: SyncStatus;
  version: number;
  files: { images: number; videos: number; sources: number; documents: number };
  figma: boolean;
  git: boolean;
  /** ghi chú riêng của GV đang xem */
  note: { hasText: boolean; isSample: boolean } | null;
}

export interface WorkUnit {
  key: string;
  type: 'GROUP' | 'INDIVIDUAL';
  groupId: string | null;
  studentId: string | null;
  code: string;
  label: string;
  members: { studentId: string; fullName: string; studentCode: string; role: string }[];
  topic: { title: string; keywords: string[] } | null;
  submission: UnitSubmission | null;
  personal: { id: string; studentId: string | null; contributionPercent: number | null; submittedAt: string; isLate: boolean; fileCount: number; isSample: boolean; hasNote: boolean }[];
}

export interface LecturerAssignmentDetail extends Omit<AssignmentSummary, 'hasIndividualPart'> {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    workMode: WorkMode;
    productTypes: ProductType[];
    openAt: string;
    dueAt: string;
    finalDeadline: string;
    allowLate: boolean;
    lateDueAt: string | null;
    weight: number;
    suggestedTopics: string[];
    hasIndividualPart: boolean;
    groupsImportedAt: string | null;
    gradesPublishedAt: string | null;
    status: AssignmentStatus;
    autoOpen: boolean;
    createdAt: string;
    brief: { name: string; size: number } | null;
    driveFolderUrl: string | null;
    section: { id: string; code: string; studentCount: number; course: { name: string; type: string } };
  };
  views: number;
  units: WorkUnit[];
  history: { action: string; summary: string | null; actor: string; createdAt: string }[];
}

export interface RowError {
  row: number;
  studentCode?: string;
  message: string;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  totalRows: number;
  errorRows: number;
  by: string;
  completedAt: string | null;
}

export interface GroupList {
  importedAt: string | null;
  groups: {
    id: string;
    seq: number;
    code: string;
    name: string;
    members: { studentId: string; studentCode: string; fullName: string; role: string }[];
    topic: { title: string; keywords: string[] } | null;
    submission: { id: string; submittedAt: string; isLate: boolean } | null;
  }[];
  ungrouped: { studentId: string; studentCode: string; fullName: string }[];
  reports: {
    id: string;
    student: { studentCode: string; fullName: string };
    groupCode: string | null;
    content: string;
    status: 'OPEN' | 'RESOLVED';
    resolutionNote: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }[];
  imports: ImportHistory[];
}

export interface GroupPreview {
  jobId: string;
  fileName: string;
  totalRows: number;
  errorRows: number;
  fileErrors: number;
  groups: { code: string; name: string; isNew: boolean; size: number; members: { studentId: string; studentCode: string; fullName: string; leader: boolean }[] }[];
  moved: { studentCode: string; fullName: string; from: string; to: string; hadSubmission: boolean }[];
  ungrouped: { studentId: string; studentCode: string; fullName: string; reason: 'EMPTY' | 'NOT_IN_FILE' }[];
  removedGroups: { code: string; name: string }[];
  errors: RowError[];
}

export interface AssignmentGrades {
  publishedAt: string | null;
  rows: { studentId: string; studentCode: string; fullName: string; group: string | null; topic: string | null; score: number | null; note: string | null; updatedAt: string | null }[];
  stats: { students: number; graded: number; avg: number | null; max: number | null; min: number | null; histogram: { label: string; count: number }[] };
  imports: ImportHistory[];
}

export interface AssignmentGradePreview {
  jobId: string;
  fileName: string;
  totalRows: number;
  errorRows: number;
  withScore: number;
  empty: number;
  changed: number;
  rows: { studentId: string; studentCode: string; fullName: string; oldScore: number | null; oldNote: string | null; score: number | null; note: string | null; changed: boolean }[];
  missing: { studentCode: string; fullName: string }[];
  errors: RowError[];
}

export type GradeComp = 'attendance' | 'assignment' | 'midterm' | 'final';

export interface GradebookItem {
  id: string;
  code: string;
  course: { code: string; name: string; credits: number };
  semester: Semester & { term: string };
  students: number;
  graded: number;
  status: 'EMPTY' | 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
}

export interface SectionGrades {
  section: { id: string; code: string; course: { code: string; name: string; credits: number; type: string }; semester: { code: string; academicYear: string; term: string }; publishedAt: string | null };
  weights: Record<GradeComp, number>;
  assignments: { id: string; title: string; weight: number; publishedAt: string | null }[];
  rows: ({ studentId: string; studentCode: string; fullName: string; assignments: (number | null)[]; suggestedAssignment: number | null; total: number | null; letter: string | null; gpa4: number | null } & Record<GradeComp, number | null>)[];
  stats: { students: number; complete: number; avg: number | null; failing: number; histogram: { label: string; count: number }[] };
  imports: ImportHistory[];
}

export interface SectionGradePreview {
  jobId: string;
  fileName: string;
  totalRows: number;
  errorRows: number;
  complete: number;
  incomplete: number;
  changed: number;
  rows: { studentId: string; studentCode: string; fullName: string; old: Record<GradeComp, number | null>; values: Record<GradeComp, number | null>; total: number | null; letter: string | null; changed: boolean }[];
  missing: { studentCode: string; fullName: string }[];
  errors: RowError[];
}

export interface MyGrades {
  cpa: number | null;
  credits: number;
  rank: string | null;
  terms: {
    code: string;
    academicYear: string;
    term: string;
    gpa: number | null;
    credits: number;
    courses: ({ sectionId: string; sectionCode: string; course: { code: string; name: string; credits: number }; total: number | null; letter: string | null; gpa4: number | null } & Record<GradeComp, number | null>)[];
  }[];
  assignments: { assignmentId: string; title: string; course: string; sectionCode: string; semester: string; weight: number; score: number | null; note: string | null; publishedAt: string }[];
}

// ================================================================ Sinh viên

export interface SubmissionFile {
  id: string;
  name: string;
  fileType: 'IMAGE' | 'VIDEO' | 'SOURCE' | 'DOCUMENT';
  mimeType?: string;
  size: number;
  syncStatus: SyncStatus;
}

export interface Feedback {
  lecturer: string;
  content: string;
  updatedAt: string;
}

export interface StudentSubmission {
  id: string;
  kind: 'GROUP_SHARED' | 'PERSONAL';
  version: number;
  status: string;
  isLate: boolean;
  submittedAt: string;
  submittedBy: string;
  submittedByCode: string;
  syncStatus: SyncStatus;
  figmaUrl: string | null;
  gitUrl: string | null;
  note: string | null;
  contributionPercent: number | null;
  files: SubmissionFile[];
  /** nhận xét của GV gửi SV */
  feedback: Feedback[];
}

export interface StudentSectionInfo {
  id: string;
  code: string;
  schedule: string | null;
  course: { code: string; name: string; type: string; credits: number; weights: { attendance: number; assignment: number; midterm: number; final: number } };
  semester: Semester;
  lecturer: { fullName: string; email: string };
}

export interface MyWork {
  assignment: {
    id: string;
    title: string;
    description: string | null;
    workMode: WorkMode;
    productTypes: ProductType[];
    openAt: string;
    dueAt: string;
    finalDeadline: string;
    allowLate: boolean;
    lateDueAt: string | null;
    suggestedTopics: string[];
    hasIndividualPart: boolean;
    weight: number;
    groupsImportedAt: string | null;
    gradesPublishedAt: string | null;
    brief: { name: string; size: number } | null;
    status: AssignmentStatus;
    accepting: boolean;
    section: StudentSectionInfo;
  };
  me: { studentId: string };
  group: {
    id: string;
    seq: number;
    code: string;
    name: string;
    members: { studentId: string; studentCode: string; fullName: string; role: string }[];
  } | null;
  report: { id: string; content: string; status: 'OPEN' | 'RESOLVED'; resolutionNote: string | null; createdAt: string; resolvedAt: string | null } | null;
  topic: {
    id: string;
    title: string;
    keywords: string[];
    updatedAt: string;
    history: { action: 'CREATE' | 'UPDATE'; title: string; note: string | null; actor: string; createdAt: string }[];
    similar: { title: string; owner: string }[];
  } | null;
  grade: { score: number | null; note: string | null; publishedAt: string | null } | null;
  status: MyStatus;
  lateDays: number;
  shared: StudentSubmission | null;
  personal: StudentSubmission | null;
  events: { action: string; actor: string; version: number; detail: { added?: { name: string }[]; removed?: { name: string }[] } | null; createdAt: string }[];
}

export interface StudentAssignmentRow {
  id: string;
  title: string;
  workMode: WorkMode;
  hasIndividualPart: boolean;
  openAt: string;
  dueAt: string;
  finalDeadline: string;
  gradesPublished: boolean;
  productTypes: ProductType[];
  hasBrief: boolean;
  section?: { id: string; code: string; course: string };
  status: MyStatus;
  score: number | null;
  submittedAt: string | null;
  groupCode: string | null;
  groupName: string | null;
  groupSize: number | null;
  topic: string | null;
}

export interface StudentSection extends StudentSectionInfo {
  assignmentCount: number;
  submittedCount: number;
  dueSoonCount: number;
}

export interface SubmissionView {
  id: string;
  kind: 'GROUP_SHARED' | 'PERSONAL';
  owner: string;
  assignment: { id: string; title: string; section: string; course: string };
  topic: { title: string; keywords: string[] } | null;
  submittedBy: string;
  submittedAt: string;
  isLate: boolean;
  version: number;
  syncStatus: SyncStatus;
  figmaUrl: string | null;
  gitUrl: string | null;
  note: string | null;
  contributionPercent: number | null;
  canDownload: boolean;
  files: SubmissionFile[];
  feedback: Feedback[];
}
