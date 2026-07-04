import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees/index";
import EmployeeDetailPage from "@/pages/employees/detail";
import NewEmployeePage from "@/pages/employees/new";
import BranchesPage from "@/pages/branches";
import DepartmentsPage from "@/pages/departments";
import ShiftsPage from "@/pages/shifts";
import WeeklyOffPage from "@/pages/weekly-off";
import AttendancePage from "@/pages/attendance";
import LeavesPage from "@/pages/leaves";
import AdvancesPage from "@/pages/advances";
import ContinueDutyPage from "@/pages/continue-duty";
import PayrollPage from "@/pages/payroll/index";
import PayslipPage from "@/pages/payroll/detail";
import AnnouncementsPage from "@/pages/announcements";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import AuditLogsPage from "@/pages/audit-logs";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/employees/new" component={NewEmployeePage} />
        <Route path="/employees/:id" component={EmployeeDetailPage} />
        <Route path="/employees" component={EmployeesPage} />
        <Route path="/branches" component={BranchesPage} />
        <Route path="/departments" component={DepartmentsPage} />
        <Route path="/shifts" component={ShiftsPage} />
        <Route path="/weekly-off" component={WeeklyOffPage} />
        <Route path="/attendance" component={AttendancePage} />
        <Route path="/leaves" component={LeavesPage} />
        <Route path="/advances" component={AdvancesPage} />
        <Route path="/continue-duty" component={ContinueDutyPage} />
        <Route path="/payroll/:id" component={PayslipPage} />
        <Route path="/payroll" component={PayrollPage} />
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {!isLoading && user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route>
        <ProtectedRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
