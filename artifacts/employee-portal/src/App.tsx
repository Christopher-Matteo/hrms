import React, { useState, useEffect } from "react";
import {
  User,
  Calendar,
  Clock,
  Megaphone,
  FileText,
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
  X
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
        weeklyOff: hist.filter((h: any) => h.status === "weekly_off").length,
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

  const fetchSchedule = async (t: string) => {
    try {
      const res = await fetch(`${BASE}/shifts/schedule`, {
        headers: { "Authorization": `Bearer ${t}` },
      });
      const data = await res.json();
      setSchedule(data);
    } catch {}
  };

  const handleMarkWeekoff = async (date: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/shifts/weekoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback("success", data.status === "removed" ? "Weekly off removed successfully!" : "Weekly off marked successfully!");
        fetchSchedule(token);
        fetchStats(token);
        fetchAttendance(token, attendanceFilter);
      } else {
        showFeedback("error", data.error || "Failed to mark weekly off");
      }
    } catch (e) {
      showFeedback("error", "Error connecting to server");
    }
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans flex flex-col transition-colors duration-300">
      {/* Header bar */}
      <header className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          {screen === "PORTAL" && (
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition md:hidden"
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
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

          {screen === "PORTAL" && employee && (
            <div className="flex items-center gap-3 pl-4 border-l dark:border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                {employee.photoUrl ? (
                  <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                ) : (
                  (employee.name || "").charAt(0)
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="font-semibold text-xs leading-none dark:text-zinc-200">{employee.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{employee.employeeId}</p>
              </div>
            </div>
          )}
        </div>
      </header>

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
        <div className="flex-1 flex flex-col md:flex-row">
          
          {/* Navigation Sidebar */}
          {mobileSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/40 z-30 md:hidden" 
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          <nav className={`fixed md:relative top-0 left-0 h-full md:h-auto w-64 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 p-4 space-y-2 flex-shrink-0 flex flex-col justify-between z-45 transition-transform duration-200 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}>
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 py-2 md:hidden">
                <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Self-Service</p>
                <button onClick={() => setMobileSidebarOpen(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <X className="w-4 h-4 dark:text-white" />
                </button>
              </div>
              <p className="hidden md:block text-[10px] text-zinc-400 uppercase font-bold tracking-widest px-3 py-2">Self-Service</p>
              
              <button
                onClick={() => { setActiveTab("DASHBOARD"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "DASHBOARD"
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <User className="w-4 h-4" />
                Dashboard Home
              </button>

              <button
                onClick={() => { setActiveTab("BIOMETRIC_ATTENDANCE"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "BIOMETRIC_ATTENDANCE"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <Camera className="w-4 h-4" />
                Biometric Check-In
              </button>

              <button
                onClick={() => { setActiveTab("ATTENDANCE"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "ATTENDANCE"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <Clock className="w-4 h-4" />
                Attendance History
              </button>

              <button
                onClick={() => { setActiveTab("LEAVES"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "LEAVES"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Leaves & Corrections
              </button>

              <button
                onClick={() => { setActiveTab("ANNOUNCEMENTS"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "ANNOUNCEMENTS"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <Megaphone className="w-4 h-4" />
                Announcements
              </button>

              <button
                onClick={() => { setActiveTab("DOCUMENTS"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "DOCUMENTS"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                Salary & Documents
              </button>

              <button
                onClick={() => { setActiveTab("SUPPORT"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "SUPPORT"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Support Ticket
              </button>

              <button
                onClick={() => { setActiveTab("SETTINGS"); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeTab === "SETTINGS"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </button>
            </div>

            <button
              onClick={() => { handleLogout(); setMobileSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </nav>

          {/* Main viewport */}
          <main className="flex-1 p-6 space-y-6 overflow-y-auto max-w-5xl">
            
            {activeTab === "DASHBOARD" && employee && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Profile card */}
                <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl overflow-hidden shadow-inner">
                    {employee.photoUrl ? (
                      <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                    ) : (
                      (employee.name || "").charAt(0)
                    )}
                  </div>
                  <div className="text-center md:text-left flex-1 space-y-1">
                    <h3 className="font-extrabold text-xl dark:text-white leading-tight">{employee.name}</h3>
                    <p className="text-sm text-muted-foreground">{employee.designation} · {employee.department}</p>
                    <p className="text-xs text-zinc-400">{employee.branchName}</p>
                  </div>
                  <div className="px-5 py-2.5 bg-muted/40 rounded-2xl text-center md:text-right border">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Account Status</p>
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">
                      {employee.accountStatus}
                    </span>
                  </div>
                </div>

                {/* Metrics Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Present Days</p>
                    <p className="text-3xl font-extrabold text-green-600 font-mono">{stats.present}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Absent Days</p>
                    <p className="text-3xl font-extrabold text-red-500 font-mono">{stats.absent}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Weekly Off</p>
                    <p className="text-3xl font-extrabold text-blue-500 font-mono">{stats.weeklyOff}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Approved Leaves</p>
                    <p className="text-3xl font-extrabold text-purple-500 font-mono">{stats.leaves}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Shifts & Holidays */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Upcoming Shifts</h4>
                    <div className="space-y-3">
                      {(() => {
                        let limit = 4;
                        const policyName = employee?.weeklyOffPolicy?.name?.toLowerCase();
                        if (policyName?.includes("month-")) {
                          const match = policyName.match(/month-(\d+)/);
                          if (match) {
                            limit = parseInt(match[1], 10);
                          }
                        } else if (policyName?.includes("week-")) {
                          const match = policyName.match(/week-(\d+)/);
                          if (match) {
                            limit = parseInt(match[1], 10) * 4;
                          }
                        } else {
                          const isHousekeeping = employee?.department?.toLowerCase() === "housekeeping" || employee?.weeklyOffPolicy?.policyType === "one_week_per_month" || employee?.weeklyOffPolicy?.policyType === "one_day_per_month";
                          limit = isHousekeeping ? 1 : 4;
                        }
                        const weeklyOffCount = stats.weeklyOff || 0;
                        const limitReached = weeklyOffCount >= limit;

                        return schedule.length > 0 ? (
                          schedule.map((s) => (
                            <div key={s.id} className="flex justify-between items-center text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-zinc-200">{s.date}</span>
                                <span className="text-xs text-zinc-500">
                                  {s.isWeekoff ? (
                                    <span className="text-blue-500 dark:text-blue-400 font-medium">Weekly Off (No Working)</span>
                                  ) : (
                                    `${s.name} (${s.startTime} - ${s.endTime})`
                                  )}
                                </span>
                              </div>
                              <div>
                                {s.isWeekoff ? (
                                  <button
                                    onClick={() => handleMarkWeekoff(s.date)}
                                    className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase border border-blue-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer"
                                    title="Click to remove weekly off"
                                  >
                                    Weekoff
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => !limitReached && handleMarkWeekoff(s.date)}
                                    disabled={limitReached}
                                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all border ${
                                      limitReached
                                        ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-50 blur-[0.5px]"
                                        : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-500 hover:text-white hover:border-blue-500"
                                    }`}
                                    title={limitReached ? `Monthly limit of ${limit} week-off(s) reached` : "Mark as Weekoff"}
                                  >
                                    Weekoff
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No upcoming shifts assigned</p>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Priority Announcements */}
                  <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <h4 className="font-extrabold text-sm dark:text-white uppercase tracking-wider border-b pb-2">Recent Announcements</h4>
                    <div className="space-y-2">
                      {announcements.length > 0 ? (
                        announcements.slice(0, 2).map((a) => (
                          <div key={a.id} className="p-3 bg-muted/30 border rounded-xl space-y-1">
                            <div className="flex justify-between">
                              <p className="font-bold text-xs text-slate-800 dark:text-white truncate">{a.title}</p>
                              {!a.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{a.content}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">No recent announcements</p>
                      )}
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
