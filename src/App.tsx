import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import Login from "./pages/auth/Login";
import AuthCallback from "./pages/auth/AuthCallback";
import Unauthorized from "./pages/auth/Unauthorized";
import InitSetup from "./pages/setup/InitSetup";
import Dashboard from "./pages/dashboard/Dashboard";
import EmployeePage from "./pages/settings/EmployeePage";
import GroupsPage from "./pages/settings/GroupsPage";
import HierarchyPage from "./pages/settings/HierarchyPage";
import ZonesPage from "./pages/settings/ZonesPage";
import CompanyPage from "./pages/settings/CompanyPage";
import CategoryPage from "./pages/settings/CategoryPage";
import UserReportPage from "./pages/report/UserReportPage";
import MonthlyReportPage from "./pages/report/MonthlyReportPage";
import UserSummaryPage from "./pages/report/UserSummaryPage";
import ShiftingPage from "./pages/manage/ShiftingPage";
import LeavePage from "./pages/manage/LeavePage";
import ApprovalPage from "./pages/manage/ApprovalPage";
import IssueAttendancePage from "./pages/attendance/IssueAttendancePage";
import LocationMapPage from "./pages/attendance/LocationMapPage";
import ActivityReportPage from "./pages/report/ActivityReportPage";
import NewsFeedPage from "./pages/manage/NewsFeedPage";
import AuditTrailPage from "./pages/manage/AuditTrailPage";
import CalendarPage from "./pages/manage/CalendarPage";

const adminRoles = ["admin", "hr", "super_admin"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/unauthorized" element={<Unauthorized />} />
          <Route path="/setup" element={<InitSetup />} />

          {/* Protected */}
          <Route element={<ProtectedRoute allowedRoles={adminRoles} />}>
            <Route element={<AppLayout />}>
              <Route path="/summary-report" element={<Dashboard />} />

              {/* Attendance */}
              {/* <Route path="/summary-report" element={<SummaryReport />} /> */}
              <Route path="/attendance/location-map" element={<LocationMapPage />} />
              <Route path="/attendance/issue" element={<IssueAttendancePage />} />

              {/* Report */}
              <Route path="/report/user" element={<UserReportPage />} />
              <Route path="/report/monthly" element={<MonthlyReportPage />} />
              <Route path="/report/activity" element={<ActivityReportPage />} />
              <Route path="/report/user-summary" element={<UserSummaryPage />} />

              {/* Manage */}
              <Route path="/manage/shifting" element={<ShiftingPage />} />
              <Route path="/manage/approval" element={<ApprovalPage />} />
              <Route path="/manage/leave" element={<LeavePage />} />
              <Route path="/manage/calendar" element={<CalendarPage />} />
              <Route path="/manage/news-feed" element={<NewsFeedPage />} />
              <Route path="/manage/audit-trail" element={<AuditTrailPage />} />

              {/* Settings */}
              <Route path="/settings/employee" element={<EmployeePage />} />
              <Route path="/settings/groups" element={<GroupsPage />} />
              <Route path="/settings/hierarchy" element={<HierarchyPage />} />
              <Route path="/settings/category" element={<CategoryPage />} />
              <Route path="/settings/zones" element={<ZonesPage />} />
              <Route path="/settings/company" element={<CompanyPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/summary-report" replace />} />
          <Route path="*" element={<Navigate to="/summary-report" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
