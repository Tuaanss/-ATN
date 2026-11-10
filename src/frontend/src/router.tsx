import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { FullscreenLoading, RequireRole, homeOf, useAuth } from './auth/auth';
import { LoginPage } from './pages/LoginPage';
import { NotFound } from './pages/NotFound';
import { NotificationsPage } from './pages/NotificationsPage';
import { MediaViewer } from './pages/MediaViewer';
import { LecturerDashboard } from './pages/lecturer/LecturerDashboard';
import { LecturerClasses } from './pages/lecturer/LecturerClasses';
import { AssignmentForm } from './pages/lecturer/AssignmentForm';
import { LecturerAssignmentDetail } from './pages/lecturer/LecturerAssignmentDetail';
import { DrivePage } from './pages/lecturer/DrivePage';
import { StatsPage } from './pages/lecturer/StatsPage';
import { PrivacyPage } from './pages/student/PrivacyPage';
import { AccountPage } from './pages/AccountPage';
import { ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages';
import { Gradebook, GradebookHome } from './pages/lecturer/Gradebook';
import { SearchPage } from './pages/lecturer/SearchPage';
import { StudentGrades } from './pages/student/StudentGrades';
import { ProfilePage } from './pages/student/ProfilePage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentAssignments } from './pages/student/StudentAssignments';
import { StudentCourse } from './pages/student/StudentCourse';
import { AssignmentWork } from './pages/student/AssignmentWork';
import { SubmitPage } from './pages/student/SubmitPage';
import { ConfirmProvider } from './pages/admin/kit';
import { ChooseChild } from './pages/parent/ChooseChild';
import { EnterpriseDashboard } from './pages/enterprise/EnterpriseDashboard';
import { EnterpriseSearch } from './pages/enterprise/EnterpriseSearch';
import { EnterpriseProfile, EnterpriseStudents } from './pages/enterprise/EnterpriseProfile';
import { EnterpriseGrants } from './pages/enterprise/EnterpriseGrants';
import { EnterpriseTalentMap } from './pages/enterprise/EnterpriseTalentMap';
import { AdminViewRequests } from './pages/admin/AdminViewRequests';
import { ParentResults } from './pages/parent/ParentResults';
import { ParentSubmissions } from './pages/parent/ParentSubmissions';
import { ParentNotifications } from './pages/parent/ParentNotifications';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { LecturersPage, ParentsPage, StudentsPage } from './pages/admin/AdminUsers';
import { ImportStudents } from './pages/admin/ImportStudents';
import { ImportGeneric } from './pages/admin/ImportGeneric';
import { EnterpriseStatsPage, EnterprisesPage } from './pages/admin/AdminEnterprises';
import { CatalogPage, SemestersPage } from './pages/admin/AdminAcademic';
import { SectionsPage } from './pages/admin/AdminSections';
import { ConfigPage, LogsPage } from './pages/admin/AdminSystem';

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoading />;
  return <Navigate to={homeOf(user?.role)} replace />;
}

function RequireLogin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (user.mcp) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/change-password', element: <ChangePasswordPage /> },
  {
    path: '/view/:submissionId',
    element: (
      <RequireLogin>
        <MediaViewer />
      </RequireLogin>
    ),
  },
  {
    path: '/lecturer',
    element: (
      <RequireRole role="LECTURER">
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <LecturerDashboard /> },
      { path: 'sections', element: <LecturerClasses /> },
      { path: 'sections/:sectionId', element: <LecturerClasses /> },
      { path: 'sections/:sectionId/assignments/new', element: <AssignmentForm /> },
      { path: 'assignments/new', element: <AssignmentForm /> },
      { path: 'assignments/:id', element: <LecturerAssignmentDetail /> },
      { path: 'assignments/:id/edit', element: <AssignmentForm /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'gradebook', element: <GradebookHome /> },
      { path: 'gradebook/:sectionId', element: <Gradebook /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'drive', element: <DrivePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/student',
    element: (
      <RequireRole role="STUDENT">
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: 'assignments', element: <StudentAssignments /> },
      { path: 'courses', element: <Navigate to="/student/assignments" replace /> },
      { path: 'courses/:sectionId', element: <StudentCourse /> },
      { path: 'assignments/:id', element: <AssignmentWork /> },
      { path: 'assignments/:id/submit', element: <SubmitPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'grades', element: <StudentGrades /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/enterprise',
    element: (
      <RequireRole role="ENTERPRISE">
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <EnterpriseDashboard /> },
      { path: 'search', element: <EnterpriseSearch /> },
      { path: 'students', element: <EnterpriseStudents /> },
      { path: 'students/:id', element: <EnterpriseProfile /> },
      { path: 'grants', element: <EnterpriseGrants /> },
      { path: 'talent-map', element: <EnterpriseTalentMap /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/parent/choose',
    element: (
      <RequireRole role="PARENT">
        <ChooseChild />
      </RequireRole>
    ),
  },
  {
    path: '/parent',
    element: (
      <RequireRole role="PARENT">
        <AppLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <ParentResults /> },
      { path: 'submissions', element: <ParentSubmissions /> },
      { path: 'notifications', element: <ParentNotifications /> },
      { path: 'account', element: <AccountPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <RequireRole role="ADMIN">
        <ConfirmProvider>
          <AppLayout />
        </ConfirmProvider>
      </RequireRole>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'lecturers', element: <LecturersPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/import', element: <ImportStudents /> },
      { path: 'import/:kind', element: <ImportGeneric /> },
      { path: 'parents', element: <ParentsPage /> },
      { path: 'enterprises', element: <EnterprisesPage /> },
      { path: 'enterprises/stats', element: <EnterpriseStatsPage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'semesters', element: <SemestersPage /> },
      { path: 'sections', element: <SectionsPage /> },
      { path: 'view-requests', element: <AdminViewRequests /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
