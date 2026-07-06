import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useWebSocket } from "@/lib/useWebSocket";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ParentLogin from "./pages/ParentLogin";
import CoachLogin from "./pages/CoachLogin";
import AdminLogin from "./pages/AdminLogin";
import Payment from "./pages/Payment";
import History from "./pages/History";
import Admin from "./pages/Admin";
import CoachDashboard from "./pages/CoachDashboard";
import Parent from "./pages/Parent";
import EliteManagement from "./pages/EliteManagement";
import ParentAttendance from "./pages/ParentAttendance";
import ExamAttendance from "./pages/ExamAttendance";
import StaffLogin from "./pages/StaffLogin";
import StaffDashboard from "./pages/StaffDashboard";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/parent-login"} component={ParentLogin} />
      <Route path={"/coach-login"} component={CoachLogin} />
      <Route path={"/admin-login"} component={AdminLogin} />
      <Route path={"/payment"} component={Payment} />
      <Route path={"/history"} component={History} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/coach"} component={CoachDashboard} />
      <Route path={"/parent"} component={Parent} />
      <Route path={"/elite"} component={EliteManagement} />
      <Route path={"/parent-attendance"} component={ParentAttendance} />
      <Route path={"/exam/:examId/attendance"} component={ExamAttendance} />
      <Route path={"/staff-login"} component={StaffLogin} />
      <Route path={"/staff"} component={StaffDashboard} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useWebSocket(); // 全域 WebSocket 連線 — 自動 invalidate tRPC queries
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <WebSocketProvider>
            <Router />
          </WebSocketProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
