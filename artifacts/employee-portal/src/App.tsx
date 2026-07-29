import React, { useState, useEffect } from "react";
import {
  Clock,
  Megaphone,
  HelpCircle,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileDown,
  Camera,
  ScanFace,
  Menu,
  LayoutDashboard,
  CalendarRange,
  FileSpreadsheet,
  LifeBuoy,
  ChevronDown,
  Plus,
  TrendingUp,
  MessageSquare,
  Send
} from "lucide-react";
import BiometricAttendance from "./components/BiometricAttendance";

const BASE = (import.meta as any).env.VITE_API_URL ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

type ScreenState = "LOGIN" | "REGISTER" | "FORGOT_PASSWORD" | "PORTAL" | "KIOSK";
type TabState = "DASHBOARD" | "ATTENDANCE" | "LEAVES" | "ANNOUNCEMENTS" | "DOCUMENTS" | "SUPPORT" | "SETTINGS" | "BIOMETRIC_ATTENDANCE";

export default function App() {
  const [screen, setScreen] = useState<ScreenState>("LOGIN");
  const [activeTab, setActiveTab] = useState<TabState>("DASHBOARD");
  const [darkMode, setDarkMode] = useState(false);

  // Authentication States
  const [empIdInput, setEmpIdInput] = useState("");
  const [passwdInput, setPasswdInput] = useState("");
  const [confirmPasswd, setConfirmPasswd] = useState("");
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("employee_token"));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem("employee_refresh_token"));
  const [employee, setEmployee] = useState<any>(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Email verification states for registration
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Forgot password wizard
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [emailInput, setEmailInput] = useState("");
  const [otpInput, setOtpInput] = useState("");

  // Mobile menu sidebar toggle state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Portal resources data states
  const [stats, setStats] = useState<any>({ present: 0, absent: 0, weeklyOff: 0, leaves: 0 });
  const [attendance, setAttendance] = useState<any[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState("monthly");
  const [leaves, setLeaves] = useState<any[]>([]);
  const [, setLeaveBalances] = useState<any>({ totalEntitled: 15, casualRemaining: 6, sickRemaining: 5, earnedRemaining: 4, usedCount: 0 });
  const [corrections, setCorrections] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);

  // Apply Form Inputs
  const [leaveForm, setLeaveForm] = useState({ leaveType: "casual", startDate: "", endDate: "", reason: "" });
  const [correctionForm, setCorrectionForm] = useState({ date: "", requestedCheckIn: "", requestedCheckOut: "", reason: "" });
  const [ticketForm, setTicketForm] = useState({ category: "it", title: "", description: "" });

  const [uiFeedback, setUiFeedback] = useState({ type: "", message: "" });

  // Toggle Dark Mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Load session and initiate 10s auto-refresh
  useEffect(() => {
    if (token) {
      fetchMe(token);
    }
  }, [token]);

  useEffect(() => {
    let interval: any;
    if (screen === "PORTAL" && token) {
      interval = setInterval(() => {
        loadPortalData(token);
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [screen, token]);

  const showFeedback = (type: "success" | "error", message: string) => {
    setUiFeedback({ type, message });
    setTimeout(() => setUiFeedback({ type: "", message: "" }), 5000);
  };

  const fetchMe = async (activeToken: string) => {
    try {
      const res = await fetch(`${BASE}/employees/me`, {
        headers: { "Authorization": `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployee(data);
        setScreen("PORTAL");
        // Load all tab data
        loadPortalData(activeToken);
      } else {
        // Try refresh token
        handleRefresh();
      }
    } catch {
      handleLogout();
    }
  };

  const handleRefresh = async () => {
    if (!refreshToken) {
      handleLogout();
      return;
    }
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("employee_token", data.token);
        setToken(data.token);
        fetchMe(data.token);
      } else {
        handleLogout();
      }
    } catch {
      handleLogout();
    }
  };

  const loadPortalData = (activeToken: string) => {
    fetchStats(activeToken);
    fetchAttendance(activeToken, attendanceFilter);
    fetchLeaves(activeToken);
    fetchAnnouncements(activeToken);
    fetchDocuments(activeToken);
    fetchTickets(activeToken);
    fetchHolidays(activeToken);
    fetchSchedule(activeToken);
  };

  // ----------------------------------------------------
  // API RESOURCE FETCHERS
  // ----------------------------------------------------
  const fetchStats = async (t: string) => {
    try {
      // Mock stats parser or direct query calculate client-side
      const ar = await fetch(`${BASE}/attendance/history?filter=monthly`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const hist = await ar.json();
      const present = hist.filter((h: any) => h.status === "present").length;
      const absent = hist.filter((h: any) => h.status === "absent").length;
      setStats({
        present,
        absent,
        weeklyOff: 4,
        leaves: hist.filter((h: any) => h.status.includes("leave")).length,
      });
    } catch {}
  };

  const fetchAttendance = async (t: string, filter: string) => {
    try {
      const res = await fetch(`${BASE}/attendance/history?filter=${filter}`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setAttendance(data);
    } catch {}
  };

  const fetchLeaves = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/leaves/history`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setLeaves(data);

      const balRes = await fetch(`${BASE}/leaves/balance`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const bal = await balRes.json();
      setLeaveBalances(bal);

      const corrRes = await fetch(`${BASE}/attendance/corrections`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const corr = await corrRes.json();
      setCorrections(corr);
    } catch {}
  };

  const fetchAnnouncements = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/announcements`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setAnnouncements(data);
    } catch {}
  };

  const fetchDocuments = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/documents`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setDocuments(data);
    } catch {}
  };

  const fetchTickets = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/support/tickets`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setTickets(data);
    } catch {}
  };

  const fetchHolidays = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/holidays`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setHolidays(data);
    } catch {}
  };

  const fetchSchedule = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/shifts/schedule`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setSchedule(data);
    } catch {}
  };

  // ----------------------------------------------------
  // AUTH FLOW ACTIONS
  // ----------------------------------------------------
  const handleCheckId = async () => {
    if (!empIdInput.trim()) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empIdInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Lookup failed");
      } else {
        if (data.registered) {
          setScreen("LOGIN");
        } else {
          setScreen("REGISTER");
          setEmployeeEmail(data.employee.email);
          setIsEmailOtpSent(false);
          setIsEmailVerified(false);
        }
      }
    } catch {
      setAuthError("Network error. Please check server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empIdInput.trim() || !passwdInput) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empIdInput.trim(), password: passwdInput, client: "EMPLOYEE_PORTAL" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Invalid credentials");
      } else {
        localStorage.setItem("employee_token", data.token);
        if (data.refreshToken) {
          localStorage.setItem("employee_refresh_token", data.refreshToken);
        }
        setToken(data.token);
        setRefreshToken(data.refreshToken);
        setEmployee(data.employee);
        setScreen("PORTAL");
        loadPortalData(data.token);
      }
    } catch {
      setAuthError("Server unreachable. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendRegOtp = async () => {
    if (!employeeEmail) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/employees/verify-email/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employeeEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Failed to send OTP code.");
      } else {
        setIsEmailOtpSent(true);
        showFeedback("success", "Verification OTP sent to your email.");
      }
    } catch {
      setAuthError("Network error sending verification OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleConfirmRegOtp = async () => {
    if (!otpInput) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/employees/verify-email/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employeeEmail, otp: otpInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Invalid OTP code.");
      } else {
        setIsEmailVerified(true);
        setOtpInput("");
        showFeedback("success", "Email verified successfully!");
      }
    } catch {
      setAuthError("Network error verifying OTP.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwdInput !== confirmPasswd) {
      setAuthError("Passwords do not match");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/register-employee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode: empIdInput.trim(), password: passwdInput, otp: otpInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Registration failed");
      } else {
        // Auto Login
        const loginRes = await fetch(`${BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeCode: empIdInput.trim(), password: passwdInput, client: "EMPLOYEE_PORTAL" }),
        });
        const lData = await loginRes.json();
        localStorage.setItem("employee_token", lData.token);
        if (lData.refreshToken) {
          localStorage.setItem("employee_refresh_token", lData.refreshToken);
        }
        setToken(lData.token);
        setRefreshToken(lData.refreshToken);
        setEmployee(lData.employee);
        setScreen("PORTAL");
        loadPortalData(lData.token);
      }
    } catch {
      setAuthError("Network issue. Try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("employee_token");
    localStorage.removeItem("employee_refresh_token");
    setToken(null);
    setRefreshToken(null);
    setEmployee(null);
    setScreen("LOGIN");
  };

  // Forgot password OTP Flow
  const handleForgotRequest = async () => {
    if (!emailInput.trim()) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Request failed");
      } else {
        setForgotStep(2);
      }
    } catch {
      setAuthError("Network error.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), otp: otpInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Invalid OTP code");
      } else {
        setForgotStep(3);
      }
    } catch {
      setAuthError("Verification failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (passwdInput !== confirmPasswd) {
      setAuthError("Passwords do not match");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim(), password: passwdInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? "Reset failed");
      } else {
        showFeedback("success", "Password reset successfully. Sign in with your new password.");
        setScreen("LOGIN");
        setForgotStep(1);
        setPasswdInput("");
        setConfirmPasswd("");
        setOtpInput("");
        setEmailInput("");
      }
    } catch {
      setAuthError("Network error.");
    } finally {
      setAuthLoading(false);
    }
  };

  // ----------------------------------------------------
  // SUBMISSIONS (LEAVES, CORRECTIONS, SUPPORT)
  // ----------------------------------------------------
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/leaves/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(leaveForm),
      });
      if (res.ok) {
        showFeedback("success", "Leave request submitted successfully!");
        setLeaveForm({ leaveType: "casual", startDate: "", endDate: "", reason: "" });
        fetchLeaves(token);
      } else {
        const data = await res.json();
        showFeedback("error", data.error ?? "Submission failed");
      }
    } catch {
      showFeedback("error", "Server connection issue.");
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/attendance/correction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(correctionForm),
      });
      if (res.ok) {
        showFeedback("success", "Attendance correction request logged!");
        setCorrectionForm({ date: "", requestedCheckIn: "", requestedCheckOut: "", reason: "" });
        fetchLeaves(token); // Refreshes corrections list
      } else {
        const data = await res.json();
        showFeedback("error", data.error ?? "Request failed");
      }
    } catch {
      showFeedback("error", "Connection error.");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/support/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(ticketForm),
      });
      if (res.ok) {
        showFeedback("success", "Support ticket opened successfully!");
        setTicketForm({ category: "it", title: "", description: "" });
        fetchTickets(token);
      } else {
        const data = await res.json();
        showFeedback("error", data.error ?? "Failed to create ticket");
      }
    } catch {
      showFeedback("error", "Connection issue.");
    }
  };

  const handleAnnouncementRead = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/announcements/${id}/read`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        fetchAnnouncements(token);
      }
    } catch {}
  };

  const handleDocDownload = async (id: number, _title: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/documents/${id}/download`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        let url = data.downloadUrl;
        if (url.startsWith("/api/")) {
          url = BASE + url.substring(4);
        }
        // Open file in new tab to trigger browser download dialog
        window.open(url, "_blank");
      }
    } catch {
      showFeedback("error", "Download verification failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 font-sans flex flex-col transition-colors duration-300">
      {/* Header bar - only for login/register */}
      {screen !== "PORTAL" && (
        <header className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white font-extrabold text-sm tracking-wide">RF</span>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight leading-none dark:text-white">Red Fox Hotel</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Employee Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>
      )}

      {uiFeedback.message && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl animate-in slide-in-from-bottom-4 duration-300 ${
          uiFeedback.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {uiFeedback.type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{uiFeedback.message}</span>
        </div>
      )}

      {screen === "KIOSK" ? (
        <BiometricAttendance
          mode="kiosk"
          onExitKiosk={() => setScreen("LOGIN")}
        />
      ) : screen !== "PORTAL" ? (
        /* Login / Signup / Recovery views */
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl shadow-xl p-8 space-y-6">
            
            {screen === "LOGIN" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Welcome Back</h2>
                  <p className="text-muted-foreground text-xs mt-1">Access your employee dashboard securely</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Employee ID</label>
                    <input
                      type="text"
                      value={empIdInput}
                      onChange={(e) => setEmpIdInput(e.target.value.toUpperCase())}
                      placeholder="EMP001"
                      className="w-full px-4 py-2.5 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => setScreen("FORGOT_PASSWORD")}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      value={passwdInput}
                      onChange={(e) => setPasswdInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCheckId}
                    disabled={authLoading}
                    className="px-4 py-3 border rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 dark:text-white"
                  >
                    Check ID
                  </button>
                  <button
                    type="submit"
                    disabled={authLoading || !empIdInput || !passwdInput}
                    className="flex-1 py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {authLoading ? "Signing in..." : "Sign In"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="pt-3 text-center border-t dark:border-zinc-850">
                  <button
                    type="button"
                    onClick={() => setScreen("KIOSK")}
                    className="text-xs text-zinc-500 hover:text-primary dark:hover:text-primary font-bold transition flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <ScanFace className="w-4 h-4" />
                    Launch Shared Kiosk Mode
                  </button>
                </div>
              </form>
            )}

            {screen === "REGISTER" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Create Account</h2>
                  <p className="text-muted-foreground text-xs mt-1">Set up credentials for Employee ID <span className="font-mono font-bold text-primary">{empIdInput}</span></p>
                </div>

                {!isEmailOtpSent && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      We need to verify your email address before setting up your password. A 6-digit OTP code will be sent to your registered email: <strong>{employeeEmail}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={handleSendRegOtp}
                      disabled={authLoading}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:opacity-90 transition"
                    >
                      {authLoading ? "Sending OTP..." : "Send Verification OTP"}
                    </button>
                  </div>
                )}

                {isEmailOtpSent && !isEmailVerified && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Check server console logs for the mocked 6-digit OTP code.</p>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Enter OTP</label>
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="123456"
                        className="w-full px-4 py-2.5 border rounded-xl text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleConfirmRegOtp}
                      disabled={authLoading}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm"
                    >
                      {authLoading ? "Verifying..." : "Verify OTP"}
                    </button>
                  </div>
                )}

                {isEmailVerified && (
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Password (Min 6 characters)</label>
                        <input
                          type="password"
                          value={passwdInput}
                          onChange={(e) => setPasswdInput(e.target.value)}
                          placeholder="Choose password"
                          className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPasswd}
                          onChange={(e) => setConfirmPasswd(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading || passwdInput.length < 6}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:opacity-90 transition"
                    >
                      {authLoading ? "Saving..." : "Create credentials & Sign In"}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => setScreen("LOGIN")}
                  className="w-full py-2 border rounded-xl text-sm text-muted-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {screen === "FORGOT_PASSWORD" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Password Reset</h2>
                  <p className="text-muted-foreground text-xs mt-1">Follow the OTP validation wizard to reset your password</p>
                </div>

                {forgotStep === 1 && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Registered Email</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="yourname@redfoxhotel.com"
                        className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={handleForgotRequest}
                      disabled={authLoading || !emailInput.trim()}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm"
                    >
                      {authLoading ? "Requesting..." : "Request OTP"}
                    </button>
                  </div>
                )}

                {forgotStep === 2 && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Check server console logs for the mocked 6-digit OTP code.</p>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Enter OTP</label>
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="123456"
                        className="w-full px-4 py-2.5 border rounded-xl text-center text-lg tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 dark:text-white font-mono"
                      />
                    </div>
                    <button
                      onClick={handleVerifyOtp}
                      disabled={authLoading}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm"
                    >
                      Verify OTP
                    </button>
                  </div>
                )}

                {forgotStep === 3 && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">New Password</label>
                      <input
                        type="password"
                        value={passwdInput}
                        onChange={(e) => setPasswdInput(e.target.value)}
                        placeholder="Choose password"
                        className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPasswd}
                        onChange={(e) => setConfirmPasswd(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700"
                      />
                    </div>
                    <button
                      onClick={handleResetPassword}
                      disabled={authLoading}
                      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl text-sm"
                    >
                      Reset Password
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setScreen("LOGIN");
                    setForgotStep(1);
                  }}
                  className="w-full py-2 border rounded-xl text-sm text-muted-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            )}

            {authError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Logged in portal dashboard workspace */
        /* Logged in portal dashboard workspace */
        <div className="flex-1 flex flex-col md:flex-row bg-[#eaeaea] dark:bg-zinc-950 min-h-screen md:min-h-0">
          
          {/* Navigation Sidebar */}
          {mobileSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/40 z-35 md:hidden" 
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <nav className={`fixed md:relative top-0 left-0 h-screen md:h-auto w-64 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 p-6 flex-shrink-0 flex flex-col justify-between z-40 transition-transform duration-200 overflow-y-auto ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}>
            <div className="space-y-6">
              {/* User Avatar + Welcome */}
              {employee && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shadow-sm border border-zinc-100 dark:border-zinc-800">
                    {employee.photoUrl ? (
                      <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      (employee.name || "").charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider leading-none">Welcome back,</p>
                    <p className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight mt-1">
                      {employee.name ? employee.name.split(' ')[0] : 'User'}!
                    </p>
                  </div>
                </div>
              )}

              {/* Company block */}
              <div className="bg-zinc-55 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-805 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-300 font-bold text-xs">
                    RF
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider leading-none">Company</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[120px] mt-1">Red Fox Hotel</p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </div>

              {/* Navigation Menu */}
              <div className="space-y-1">
                {[
                  { id: "DASHBOARD", label: "Dashboard", icon: LayoutDashboard },
                  { id: "BIOMETRIC_ATTENDANCE", label: "Biometric Check", icon: Camera },
                  { id: "ATTENDANCE", label: "Attendance Log", icon: Clock },
                  { id: "LEAVES", label: "Leaves & Forms", icon: CalendarRange },
                  { id: "ANNOUNCEMENTS", label: "Announcements", icon: Megaphone },
                  { id: "DOCUMENTS", label: "Salary & Docs", icon: FileSpreadsheet },
                  { id: "SUPPORT", label: "Support Tickets", icon: LifeBuoy },
                  { id: "SETTINGS", label: "Settings", icon: SettingsIcon },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id as any); setMobileSidebarOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold tracking-tight transition-all ${
                        isActive
                          ? "bg-primary text-white shadow-lg shadow-primary/25"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.id === "ANNOUNCEMENTS" && announcements.filter(a => !a.isRead).length > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold ${isActive ? "bg-white text-primary" : "bg-primary text-white"}`}>
                          {announcements.filter(a => !a.isRead).length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="space-y-4 pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800/50">
              {/* Red Card "Leave Balance" matching "Recent trips" */}
              <div className="bg-primary text-white rounded-3xl p-4 space-y-3 shadow-md relative overflow-hidden">
                <div className="absolute right-[-10px] top-[-10px] w-20 h-20 bg-white/5 rounded-full" />
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-white/80 leading-none">Leaves</p>
                    <p className="text-xs font-bold mt-1">Casual & Sick</p>
                  </div>
                  <span className="text-[9px] bg-white/20 text-white font-extrabold px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <div className="flex gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">C</span>
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">S</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black leading-none">{stats.leaves + 11} Days</p>
                    <p className="text-[8px] text-white/70 font-semibold mt-0.5">Remaining Balance</p>
                  </div>
                </div>
              </div>

              {/* Dotted Create Request Button */}
              <button
                onClick={() => { setActiveTab("LEAVES"); setMobileSidebarOpen(false); }}
                className="w-full py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-primary dark:hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 group transition-colors bg-white dark:bg-zinc-900"
              >
                <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] text-zinc-400 group-hover:text-zinc-650 dark:group-hover:text-zinc-200 font-extrabold uppercase tracking-wider transition-colors">
                  Create new Request
                </span>
              </button>

              <button
                onClick={() => { handleLogout(); setMobileSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>

          {/* Main viewport */}
          <main className="flex-1 p-6 space-y-6 overflow-y-auto max-w-6xl w-full">
            {/* Mobile Top Bar */}
            {employee && (
              <div className="flex items-center justify-between md:hidden bg-white dark:bg-zinc-900 border dark:border-zinc-800 p-4 rounded-3xl shadow-sm mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                    {employee.photoUrl ? (
                      <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      (employee.name || "").charAt(0)
                    )}
                  </div>
                  <span className="font-extrabold text-sm text-slate-800 dark:text-white">Red Fox Hotel</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setMobileSidebarOpen(true)}
                    className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === "DASHBOARD" && employee && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Dashboard Header */}
                <div className="hidden md:flex justify-between items-center pb-2">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Portal Dashboard</h2>
                    <p className="text-xs text-muted-foreground font-semibold mt-0.5">Real-time status check and hotel operations metrics</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-xl bg-white dark:bg-zinc-900 border dark:border-zinc-800 shadow-sm transition"
                    >
                      {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
                    </button>
                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border dark:border-zinc-850 px-3 py-2 rounded-xl text-xs font-extrabold text-zinc-500 shadow-sm">
                      <span>Shift Profile</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Main Visual Tracking Card (like the shipment track map) */}
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Left Side: Shift Tracking Data */}
                  <div className="lg:col-span-2 space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-primary text-white text-[10px] font-extrabold rounded-full uppercase tracking-wider">Tracking</span>
                        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">Geofence</span>
                        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">POI</span>
                      </div>
                      
                      <div className="pt-2">
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider leading-none">Distance to geofence:</p>
                        <div className="flex items-baseline gap-1 mt-1.5">
                          <span className="text-3xl font-black tracking-tight text-slate-800 dark:text-white font-mono">120</span>
                          <span className="text-sm font-extrabold text-zinc-400 uppercase">Meters</span>
                          <span className="text-zinc-300 mx-2">/</span>
                          <span className="text-lg font-black text-primary font-mono">Inside</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider leading-none">Work efficiency rating:</p>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-slate-800 dark:text-white font-mono leading-none">92%</span>
                          <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: "92%" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-4">
                      <button 
                        onClick={() => setActiveTab("BIOMETRIC_ATTENDANCE")}
                        className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white rounded-2xl text-xs font-bold shadow-md shadow-primary/20 transition-all uppercase tracking-wider"
                      >
                        Check-in Now
                      </button>
                      <button 
                        onClick={() => setActiveTab("ATTENDANCE")}
                        className="py-3 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider"
                      >
                        View Log
                      </button>
                    </div>
                  </div>

                  {/* Right Side: Map Timeline Visual */}
                  <div className="lg:col-span-3 min-h-[220px] bg-slate-50 dark:bg-zinc-800/40 rounded-2xl p-4 flex flex-col justify-between border border-dashed border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
                    {/* Visual Stylized Map Route */}
                    <div className="absolute inset-0 opacity-10 dark:opacity-5">
                      <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                    </div>

                    {/* SVG map road representation */}
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120" fill="none">
                        <path 
                          d="M10 60 C 80 10, 120 110, 200 30 C 240 -10, 260 90, 290 50" 
                          stroke="#ef4444" 
                          strokeWidth="4" 
                          strokeLinecap="round" 
                          fill="none" 
                        />
                        <circle cx="10" cy="60" r="10" fill="#ef4444" className="animate-pulse" />
                        <text x="10" y="63" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">1</text>

                        <circle cx="160" cy="55" r="10" fill="#ef4444" />
                        <text x="160" y="58" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">2</text>

                        <circle cx="290" cy="50" r="10" fill="#ef4444" />
                        <text x="290" y="53" fill="#fff" fontSize="8" fontWeight="bold" textAnchor="middle">3</text>
                      </svg>
                    </div>

                    {/* Geofence notice block */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border dark:border-zinc-800 rounded-2xl p-4 shadow-sm max-w-[240px] ml-auto z-10 self-end">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 leading-none">Alerts & Notifications</span>
                        <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      </div>
                      <h5 className="font-extrabold text-xs text-slate-800 dark:text-white mt-2 leading-none">Geofence Verified</h5>
                      <p className="text-[10px] text-zinc-400 mt-1.5 leading-normal">
                        Device location matches Nungambakkam branch. Automated check-in active.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Middle Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Card 2: Shift Details (Shipment details in screenshot) */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm lg:col-span-2 space-y-5">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Shift & Profile Details</h4>
                      <button onClick={() => setActiveTab("SETTINGS")} className="text-[10px] text-zinc-400 font-extrabold underline hover:text-primary transition-colors">Read more</button>
                    </div>

                    <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                        {employee.photoUrl ? (
                          <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                        ) : (
                          (employee.name || "").charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-800 dark:text-white leading-tight">{employee.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{employee.employeeId} · {employee.designation || 'Front Desk'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider leading-none">Shift Hours</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-2">
                          {schedule.length > 0 ? `${schedule[0].startTime} - ${schedule[0].endTime}` : '09:00 - 18:00'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider leading-none">Weekly Off</p>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-white mt-2">Sunday</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider leading-none">Status</p>
                        <span className="px-2.5 py-0.5 bg-primary text-white text-[9px] font-extrabold rounded-full uppercase tracking-wider mt-1.5 inline-block">
                          {employee.accountStatus || 'Active'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
                      <span>Date of Joining:</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-300">
                        {employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '28.10.2023'}
                      </span>
                    </div>
                    {holidays && holidays.length > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 pt-2 leading-none">
                        <span>Upcoming Holiday:</span>
                        <span className="font-bold text-primary">
                          {holidays[0].name} ({holidays[0].date})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Attendance Capacity Progress Bar (Current truck capacity) */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Attendance Rate</h4>
                      <button onClick={() => setActiveTab("ATTENDANCE")} className="text-[10px] text-zinc-400 font-extrabold underline hover:text-primary transition-colors">Read more</button>
                    </div>

                    {/* Striped horizontal capacity progress bar */}
                    <div className="my-6 space-y-2">
                      <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800/40 rounded-2xl overflow-hidden relative border dark:border-zinc-800 flex items-center justify-center">
                        <div 
                          className="h-full bg-primary rounded-2xl absolute left-0 top-0 transition-all duration-500" 
                          style={{ 
                            width: "86%", 
                            backgroundImage: "linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent)", 
                            backgroundSize: "1rem 1rem" 
                          }} 
                        />
                        <span className="z-10 font-black text-sm md:text-base text-white tracking-tight">86% Attendance</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase leading-none pb-1.5">
                        <span>Code: {employee.employeeId}</span>
                        <span className="text-primary font-bold">● Checked In</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-400 pt-2 border-t dark:border-zinc-800/50 leading-none">
                        <span>Expected Days:</span>
                        <span className="font-bold text-slate-700 dark:text-zinc-300">30 Days</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Card 4: Trends (Shipment trends in image) */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Weekly Work Hours</h4>
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>

                    {/* Tiny custom bar chart representing work hours */}
                    <div className="h-32 flex items-end justify-between gap-1 pt-6 px-2">
                      {[
                        { day: "M", hrs: 8 },
                        { day: "T", hrs: 8.5 },
                        { day: "W", hrs: 9 },
                        { day: "T", hrs: 8 },
                        { day: "F", hrs: 9.5, highlight: true },
                        { day: "S", hrs: 4 },
                        { day: "S", hrs: 0 },
                      ].map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="w-full relative flex flex-col items-center">
                            <div 
                              className={`w-2.5 rounded-full transition-all duration-300 ${item.highlight ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-800 group-hover:bg-primary/50'}`} 
                              style={{ height: `${(item.hrs / 10) * 80}px` }} 
                            />
                            <span className="absolute top-[-20px] scale-0 group-hover:scale-100 transition-transform bg-zinc-800 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                              {item.hrs}h
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase leading-none">{item.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 5: Efficiency (Route efficiency red card in image) */}
                  <div className="bg-primary text-white rounded-3xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                    <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
                    
                    <div className="flex justify-between items-start z-10">
                      <div>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-white/80 leading-none">Punctuality Score</p>
                        <h4 className="text-sm font-extrabold mt-1.5">Monthly Average</h4>
                      </div>
                      <HelpCircle className="w-4 h-4 text-white/80" />
                    </div>

                    <div className="flex items-baseline gap-1 mt-4 z-10">
                      <span className="text-5xl font-black tracking-tighter">96</span>
                      <span className="text-xl font-bold">%</span>
                    </div>

                    <p className="text-[10px] text-white/80 font-medium z-10 leading-normal pt-3 border-t border-white/20">
                      Excellent! You were on-time for 96% of your shifts this month. Keep it up!
                    </p>
                  </div>

                  {/* Card 6: Chat / Announcements (Chat in image) */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[220px] space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Feed & Announcements</h4>
                      <MessageSquare className="w-4 h-4 text-zinc-400" />
                    </div>

                    {/* Chat messaging display */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs max-h-[120px]">
                      <div className="flex flex-col items-start space-y-1">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase leading-none">HR / Operations</span>
                        <div className="bg-zinc-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-2xl rounded-tl-none p-3 max-w-[90%] leading-relaxed">
                          {announcements.length > 0 ? announcements[0].content : "Welcome to the new Employee Self-Service portal. Check your documents and shifts here."}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-1">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase leading-none">Me</span>
                        <div className="bg-primary text-white rounded-2xl rounded-tr-none p-3 max-w-[90%] leading-relaxed">
                          Got it! Thank you.
                        </div>
                      </div>
                    </div>

                    {/* Quick input field mock */}
                    <div className="flex gap-2 items-center bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-3 py-2">
                      <span className="text-zinc-400 text-xs">@</span>
                      <input 
                        type="text" 
                        placeholder="Message HR / Team..." 
                        disabled
                        className="flex-1 bg-transparent border-0 p-0 text-[11px] focus:ring-0 text-slate-800 dark:text-white focus:outline-none placeholder-zinc-400" 
                      />
                      <Send className="w-3.5 h-3.5 text-zinc-400 hover:text-primary transition-colors cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ATTENDANCE" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold dark:text-white">Attendance Log</h3>
                    <p className="text-xs text-muted-foreground">Track check-in/out records, verify scores, and geolocation details</p>
                  </div>
                  <select
                    value={attendanceFilter}
                    onChange={(e) => {
                      setAttendanceFilter(e.target.value);
                      if (token) fetchAttendance(token, e.target.value);
                    }}
                    className="px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
                  >
                    <option value="weekly">Weekly View</option>
                    <option value="monthly">Monthly View</option>
                    <option value="yearly">Yearly View</option>
                  </select>
                </div>

                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b text-xs font-bold text-zinc-500 uppercase">
                          <th className="px-5 py-3.5">Date</th>
                          <th className="px-5 py-3.5">Check In</th>
                          <th className="px-5 py-3.5">Check Out</th>
                          <th className="px-5 py-3.5">Working Hours</th>
                          <th className="px-5 py-3.5">Location</th>
                          <th className="px-5 py-3.5">Verification</th>
                          <th className="px-5 py-3.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-zinc-800">
                        {attendance.length > 0 ? (
                          attendance.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300">
                              <td className="px-5 py-3 font-mono font-medium text-xs">{a.date}</td>
                              <td className="px-5 py-3 font-mono text-xs">{a.checkIn || "--:--"}</td>
                              <td className="px-5 py-3 font-mono text-xs">{a.checkOut || "--:--"}</td>
                              <td className="px-5 py-3 font-mono text-xs">{a.workingHours ? `${a.workingHours}h` : "--"}</td>
                              <td className="px-5 py-3 text-xs">{a.branchName || "Unknown"}</td>
                              <td className="px-5 py-3">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono font-bold block w-fit">
                                    Sim: {a.verificationScore ? `${Number(a.verificationScore).toFixed(1)}%` : "N/A"}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground block">
                                    GPS: {a.gpsVerified ? "✓" : "✗"} · Face: {a.faceVerified ? "✓" : "✗"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  a.status === "present" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                }`}>
                                  {a.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-xs">
                              No attendance history records found for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "LEAVES" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Apply Leave */}
                  <form onSubmit={handleApplyLeave} className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Apply Leave</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Leave Type</label>
                        <select
                          value={leaveForm.leaveType}
                          onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        >
                          <option value="casual">Casual Leave</option>
                          <option value="sick">Sick Leave</option>
                          <option value="emergency">Emergency Leave</option>
                          <option value="earned">Earned Leave</option>
                          <option value="comp_off">Comp Off</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Reason</label>
                        <input
                          type="text"
                          value={leaveForm.reason}
                          onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                          placeholder="E.g. Medical checkup"
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Start Date</label>
                        <input
                          type="date"
                          value={leaveForm.startDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">End Date</label>
                        <input
                          type="date"
                          value={leaveForm.endDate}
                          onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition"
                    >
                      Submit Leave Request
                    </button>
                  </form>

                  {/* Request Correction */}
                  <form onSubmit={handleRequestCorrection} className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Request Correction</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Date</label>
                        <input
                          type="date"
                          value={correctionForm.date}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Reason</label>
                        <input
                          type="text"
                          value={correctionForm.reason}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                          placeholder="Forgot checkout"
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Requested In</label>
                        <input
                          type="text"
                          value={correctionForm.requestedCheckIn}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                          placeholder="09:00"
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-500">Requested Out</label>
                        <input
                          type="text"
                          value={correctionForm.requestedCheckOut}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                          placeholder="17:00"
                          className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition"
                    >
                      Submit Correction Request
                    </button>
                  </form>
                </div>

                {/* History lists */}
                <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Leave Request History</h4>
                  <div className="space-y-2">
                    {leaves.length > 0 ? (
                      leaves.map((l) => (
                        <div key={l.id} className="flex justify-between items-center text-xs p-3 bg-muted/30 border rounded-xl">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-zinc-200 capitalize">{l.leaveType} Leave ({l.days} days)</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{l.startDate} to {l.endDate} · {l.reason}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            l.status === "approved" ? "bg-green-100 text-green-700" : l.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {l.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No leave requests logged</p>
                    )}
                  </div>
                </div>

                {/* Corrections lists */}
                <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                  <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Attendance Correction History</h4>
                  <div className="space-y-2">
                    {corrections.length > 0 ? (
                      corrections.map((c) => (
                        <div key={c.id} className="flex justify-between items-center text-xs p-3 bg-muted/30 border rounded-xl">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-zinc-200">Correction for date: {c.date}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Requested In: {c.requestedCheckIn || "-"} · Requested Out: {c.requestedCheckOut || "-"} · Reason: {c.reason}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                            c.status === "approved" ? "bg-green-100 text-green-700" : c.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No correction requests logged</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "ANNOUNCEMENTS" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Announcements Feed</h3>
                  <p className="text-xs text-muted-foreground">Important updates and policies targeted to your branch and department</p>
                </div>

                <div className="space-y-4">
                  {announcements.length > 0 ? (
                    announcements.map((a) => (
                      <div key={a.id} className={`p-5 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm relative ${!a.isRead ? "border-l-4 border-l-primary" : ""}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                              {a.targetRole ? `${a.targetRole} target` : "Global"}
                            </span>
                            <h4 className="font-extrabold text-base text-slate-800 dark:text-white mt-1.5">{a.title}</h4>
                          </div>
                          {!a.isRead && (
                            <button
                              onClick={() => handleAnnouncementRead(a.id)}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2.5 leading-relaxed">{a.content}</p>
                        <p className="text-[10px] text-zinc-400 mt-4 font-mono">{a.createdAt}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-white dark:bg-zinc-900 border rounded-2xl text-muted-foreground text-sm">
                      No active announcements to display.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "DOCUMENTS" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Payslips & Policies</h3>
                  <p className="text-xs text-muted-foreground">Secure document downloads using dynamic, short-lived signed URLs</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.length > 0 ? (
                    documents.map((d) => (
                      <div key={d.id} className="bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{d.title}</p>
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{d.category.replace("_", " ")} · {(d.fileSize/1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={() => handleDocDownload(d.id, d.title)}
                          className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition flex-shrink-0"
                        >
                          <FileDown className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-10 bg-white dark:bg-zinc-900 border rounded-2xl text-muted-foreground text-sm">
                      No payslips or letters published yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "SUPPORT" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Support & HR Tickets</h3>
                  <p className="text-xs text-muted-foreground">Open requests for IT support, payroll discrepancies, or HR complaints</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Create Ticket */}
                  <form onSubmit={handleCreateTicket} className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">File a Request</h4>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500">Category</label>
                      <select
                        value={ticketForm.category}
                        onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                      >
                        <option value="hr">HR Request / Policy Query</option>
                        <option value="it">IT Support / Credentials</option>
                        <option value="payroll">Payroll / Salary Issue</option>
                        <option value="maintenance">Hotel Maintenance Request</option>
                        <option value="complaint">Internal Complaint</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500">Subject</label>
                      <input
                        type="text"
                        value={ticketForm.title}
                        onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                        placeholder="E.g. Access token issue"
                        className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500">Description</label>
                      <textarea
                        value={ticketForm.description}
                        onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                        placeholder="Detail your request"
                        rows={3}
                        className="w-full px-3 py-2 border rounded-xl text-xs dark:bg-zinc-800"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:opacity-90 transition"
                    >
                      Submit Ticket
                    </button>
                  </form>

                  {/* Tickets List */}
                  <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-5 space-y-4 shadow-sm">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Active Tickets</h4>
                    <div className="space-y-2">
                      {tickets.length > 0 ? (
                        tickets.map((t) => (
                          <div key={t.id} className="p-3 bg-muted/30 border rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-zinc-200">{t.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{t.category} · {t.description}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                              t.status === "resolved" || t.status === "closed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {t.status}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-8">No tickets opened yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "SETTINGS" && (
              <div className="bg-white dark:bg-zinc-900 border rounded-2xl p-6 shadow-sm max-w-md space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-bold dark:text-white">Account Settings</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Toggle interface themes and customize credentials</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-semibold dark:text-zinc-300">Theme Preference</span>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-semibold dark:text-white"
                    >
                      {darkMode ? "Light Mode" : "Dark Mode"}
                    </button>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-semibold dark:text-zinc-300">Preferred Language</span>
                    <span className="text-xs text-zinc-500">English (IN)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "BIOMETRIC_ATTENDANCE" && employee && (
              <BiometricAttendance
                mode="self"
                loggedInEmployee={employee}
                loggedInToken={token}
                onAttendanceSuccess={() => {
                  if (token) loadPortalData(token);
                }}
              />
            )}

          </main>
        </div>
      )}
    </div>
  );
}
