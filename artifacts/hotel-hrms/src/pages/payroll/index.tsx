import { useState } from "react";
import { Link } from "wouter";
import { 
  useGetPayrollRecords, 
  useGeneratePayroll, 
  useApprovePayroll, 
  useGetBranches,
  useUpdatePayrollRecord,
  useGetEmployees,
  useGetAdvances,
  useGetAuditLogs
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Play, Check, DollarSign, Edit2, FileText, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30",
  approved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
  paid: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
};

export default function PayrollPage() {
  const { user } = useAuth();
  const { data: branches } = useGetBranches();
  const { data: employees } = useGetEmployees();
  const { data: advances } = useGetAdvances();
  const { data: auditLogs } = useGetAuditLogs();

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Selection for edit dialog
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [bonusInput, setBonusInput] = useState("0");
  const [allowanceInput, setAllowanceInput] = useState("0");

  const { data: records, isLoading, refetch } = useGetPayrollRecords({
    month: month || undefined,
    branchId: branchFilter !== "all" ? Number(branchFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const generatePayroll = useGeneratePayroll();
  const approvePayroll = useApprovePayroll();
  const updateRecord = useUpdatePayrollRecord();

  const canManage = ["super_admin", "hr_manager"].includes(user?.role ?? "");

  // Report Specific States
  const [activeReportTab, setActiveReportTab] = useState("summary");
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportEmployeeId, setReportEmployeeId] = useState("all");

  function handleGenerate() {
    if (!month) return;
    generatePayroll.mutate(
      { data: { month, branchId: branchFilter !== "all" ? Number(branchFilter) : undefined } as any },
      { onSuccess: () => refetch() }
    );
  }

  function startEdit(r: any) {
    setEditingRecord(r);
    setBonusInput(String(r.bonus || 0));
    setAllowanceInput(String(r.allowances || 0));
  }

  function handleSaveEdit() {
    if (!editingRecord) return;
    updateRecord.mutate({
      id: editingRecord.id,
      data: {
        bonus: Number(bonusInput),
        allowances: Number(allowanceInput)
      }
    }, {
      onSuccess: () => {
        setEditingRecord(null);
        refetch();
      }
    });
  }

  async function handleMarkPaid(id: number) {
    if (!confirm("Are you sure you want to mark this payroll as PAID? This will recover the calculated salary advances from the database.")) return;
    try {
      const res = await fetch(`/api/payroll/${id}/pay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (res.ok) {
        refetch();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to mark as paid");
      }
    } catch (err) {
      console.error(err);
      alert("Error marking payroll as paid");
    }
  }

  async function handleSharePayslip(id: number) {
    try {
      const res = await fetch(`/api/payroll/${id}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (res.ok) {
        alert("Payslip shared successfully with employee!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to share payslip");
      }
    } catch (e) {
      console.error(e);
      alert("Error sharing payslip");
    }
  }

  const totalNetSalary = records?.reduce((sum, r) => sum + Number(r.netSalary), 0) ?? 0;
  const totalGross = records?.reduce((sum, r) => sum + Number(r.grossSalary), 0) ?? 0;

  // Helper function to export to CSV
  function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- REPORT CALCULATIONS ---
  
  // 1. Monthly Payroll Summary
  const reportRecords = records || [];

  function exportSummaryReport() {
    const headers = ["Employee", "ID", "Branch", "Department", "Monthly Rate", "Total Days", "Daily Rate", "Payable Days", "Gross Earned", "Advance Ded.", "Allowances/Bonus", "Net Salary", "Status"];
    const rows = reportRecords.map(r => [
      r.employeeName,
      r.employeeCode,
      r.branchName ?? "Main",
      r.department,
      Number(r.basicSalary),
      Number(r.expectedWorkingDays),
      (Number(r.basicSalary) / (Number(r.expectedWorkingDays) || 30)).toFixed(2),
      r.workingDays,
      Number(r.grossSalary),
      Number(r.advanceDeduction),
      Number(r.bonus) + Number(r.allowances),
      Number(r.netSalary),
      r.status
    ]);
    downloadCSV(`payroll_summary_${reportMonth}.csv`, headers, rows);
  }

  // 2. Branch-wise Salary Report
  const branchReportMap = new Map<string, { count: number, basic: number, gross: number, advance: number, net: number }>();
  reportRecords.forEach(r => {
    const branchKey = r.branchName ?? "Main Branch";
    const existing = branchReportMap.get(branchKey) || { count: 0, basic: 0, gross: 0, advance: 0, net: 0 };
    branchReportMap.set(branchKey, {
      count: existing.count + 1,
      basic: existing.basic + Number(r.basicSalary),
      gross: existing.gross + Number(r.grossSalary),
      advance: existing.advance + Number(r.advanceDeduction),
      net: existing.net + Number(r.netSalary)
    });
  });
  const branchReportRows = Array.from(branchReportMap.entries()).map(([branchName, stats]) => ({
    branchName,
    ...stats
  }));

  function exportBranchReport() {
    const headers = ["Branch Name", "Employee Count", "Total Basic Salary", "Total Gross Salary", "Total Advance Deductions", "Total Net Salary"];
    const rows = branchReportRows.map(b => [
      b.branchName,
      b.count,
      b.basic,
      b.gross,
      b.advance,
      b.net
    ]);
    downloadCSV(`branch_salary_report_${reportMonth}.csv`, headers, rows);
  }

  // 3. Employee Salary History
  const historyEmp = employees?.find(e => String(e.id) === reportEmployeeId);
  // Fetch all payroll records for selected employee across all months (we need to bypass month filter)
  // Let's filter records from the client-side fetched data or query all?
  // We can query all records by calling `useGetPayrollRecords` without a month constraint!
  // To keep things simple and fast, we can use the records for the current filter if "all" is selected,
  // or we query a full history list. For local list, let's filter payroll records that match employeeId.
  const employeeHistoryRecords = (records || []).filter(r => String(r.employeeId) === reportEmployeeId);

  function exportHistoryReport() {
    const headers = ["Month", "Basic Rate", "Payable Days", "Gross Salary", "Advance Ded.", "Net Salary", "Status"];
    const rows = employeeHistoryRecords.map(r => [
      r.month,
      Number(r.basicSalary),
      r.workingDays,
      Number(r.grossSalary),
      Number(r.advanceDeduction),
      Number(r.netSalary),
      r.status
    ]);
    downloadCSV(`salary_history_${historyEmp ? historyEmp.firstName : "employee"}.csv`, headers, rows);
  }

  // 4. Advance Recovery Report
  const advanceReportRows = (advances || []).map(adv => {
    const emp = employees?.find(e => e.id === adv.employeeId);
    return {
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "—",
      employeeCode: emp?.employeeId ?? "—",
      date: adv.date,
      amount: Number(adv.amount),
      remaining: Number(adv.remainingBalance),
      recovered: Number(adv.amount) - Number(adv.remainingBalance),
      reason: adv.reason,
      status: adv.status
    };
  });
  const totalAdvancesGiven = advanceReportRows.reduce((sum, a) => sum + a.amount, 0);
  const totalAdvancesRecovered = advanceReportRows.reduce((sum, a) => sum + a.recovered, 0);
  const totalAdvancesOutstanding = advanceReportRows.reduce((sum, a) => sum + a.remaining, 0);

  function exportAdvanceReport() {
    const headers = ["Employee", "Code", "Advance Date", "Total Advance", "Recovered", "Remaining Balance", "Reason", "Status"];
    const rows = advanceReportRows.map(a => [
      a.employeeName,
      a.employeeCode,
      a.date,
      a.amount,
      a.recovered,
      a.remaining,
      a.reason,
      a.status
    ]);
    downloadCSV("salary_advance_recovery_report.csv", headers, rows);
  }

  // 5. Attendance Correction Report
  // Filter audit logs for entity === "attendance" and reason provided (MANUAL checks)
  const correctionLogs = (auditLogs || [])
    .filter(log => log.entity === "attendance" && (log.action === "created" || log.action === "updated"))
    .map(log => {
      let parsedChanges = { date: "", status: "", reason: "", addedBy: "" };
      try {
        parsedChanges = log.changes ? JSON.parse(log.changes) : {};
      } catch (e) {
        console.error(e);
      }
      
      const emp = employees?.find(e => e.id === log.entityId || String(e.id) === String(log.entityId));
      
      return {
        id: log.id,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : "—",
        employeeCode: emp?.employeeId ?? "—",
        date: parsedChanges.date || "—",
        status: parsedChanges.status || "—",
        reason: parsedChanges.reason || "Manual adjustment",
        modifiedBy: log.userName || "Admin",
        modifiedAt: new Date(log.createdAt).toLocaleDateString()
      };
    })
    .filter(log => log.date.startsWith(reportMonth)); // Match report month (YYYY-MM)

  function exportCorrectionReport() {
    const headers = ["Employee", "Code", "Attendance Date", "New Status", "Reason / Remarks", "Marked By", "Date Marked"];
    const rows = correctionLogs.map(c => [
      c.employeeName,
      c.employeeCode,
      c.date,
      c.status,
      c.reason,
      c.modifiedBy,
      c.modifiedAt
    ]);
    downloadCSV(`attendance_corrections_${reportMonth}.csv`, headers, rows);
  }

  // 6. Total Salary Expense
  // Group payroll expenses by Month (since it queries by selected month/filters, 
  // let's fetch total monthly sums from current list)
  const expenseSummary = {
    month: reportMonth,
    employeeCount: reportRecords.length,
    totalBasic: reportRecords.reduce((sum, r) => sum + Number(r.basicSalary), 0),
    totalGross: reportRecords.reduce((sum, r) => sum + Number(r.grossSalary), 0),
    totalDeductions: reportRecords.reduce((sum, r) => sum + Number(r.totalDeductions), 0),
    totalNet: reportRecords.reduce((sum, r) => sum + Number(r.netSalary), 0)
  };

  function exportExpenseReport() {
    const headers = ["Month", "Employee Count", "Total Contract Salary", "Total Gross Earned", "Total Deductions", "Total Net Disbursed"];
    const rows = [[
      expenseSummary.month,
      expenseSummary.employeeCount,
      expenseSummary.totalBasic,
      expenseSummary.totalGross,
      expenseSummary.totalDeductions,
      expenseSummary.totalNet
    ]];
    downloadCSV(`salary_expense_summary_${reportMonth}.csv`, headers, rows);
  }

  return (
    <div className="space-y-5">
      <Tabs defaultValue="records" className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-2 gap-4">
          <TabsList className="grid grid-cols-2 w-64 h-9">
            <TabsTrigger value="records">Payroll Records</TabsTrigger>
            <TabsTrigger value="reports">HR Reports</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generatePayroll.isPending}>
                <Play className="w-4 h-4" />
                {generatePayroll.isPending ? "Generating..." : "Generate Payroll"}
              </Button>
            )}
          </div>
        </div>

        {/* 1. Records Tab Content */}
        <TabsContent value="records" className="space-y-5 mt-4">
          <div>
            <h1 className="text-lg font-bold">Monthly Payroll Table</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Disburse, edit, and approve calculations based on attendance override data</p>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40 h-9" />
            </div>
            
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          {records && records.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Total Gross Earned", value: `₹${totalGross.toLocaleString("en-IN")}` },
                { label: "Total Deductions", value: `₹${records.reduce((s, r) => s + Number(r.totalDeductions), 0).toLocaleString("en-IN")}` },
                { label: "Total Net Disbursed", value: `₹${totalNetSalary.toLocaleString("en-IN")}` },
              ].map(({ label, value }) => (
                <Card key={label} className="border shadow-sm bg-card">
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-lg font-extrabold mt-1 text-slate-800 dark:text-white">{value}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <Card className="border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 dark:bg-zinc-800/50">
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase">Employee</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase">Branch</th>
                      <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase">Department</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Monthly Salary</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Total Days</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Daily Salary</th>
                      <th className="text-center px-3 py-3 font-bold text-muted-foreground uppercase">Present</th>
                      <th className="text-center px-3 py-3 font-bold text-muted-foreground uppercase">Leave</th>
                      <th className="text-center px-3 py-3 font-bold text-muted-foreground uppercase">W/Off</th>
                      <th className="text-center px-3 py-3 font-bold text-muted-foreground uppercase">Absent</th>
                      <th className="text-center px-3 py-3 font-bold text-muted-foreground uppercase">Manual Count</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Earned Salary</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Advance Ded.</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Allowances/Bonus</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Final Salary</th>
                      <th className="text-center px-4 py-3 font-bold text-muted-foreground uppercase">Status</th>
                      <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records?.map(r => {
                      const monthlyVal = Number(r.basicSalary);
                      const totalDaysVal = Number(r.expectedWorkingDays) || 30;
                      const dailySalaryVal = monthlyVal / totalDaysVal;
                      
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800 dark:text-zinc-200">{r.employeeName}</div>
                            <div className="text-[10px] text-muted-foreground">{r.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.branchName ?? "Main"}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.department}</td>
                          <td className="px-4 py-3 text-right font-medium">₹{monthlyVal.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{totalDaysVal}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">₹{dailySalaryVal.toFixed(2)}</td>
                          <td className="px-3 py-3 text-center font-semibold text-green-700">{r.presentDays}</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{r.leaveDays}</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{r.weeklyOffDays}</td>
                          <td className="px-3 py-3 text-center font-semibold text-red-600">{r.absentDays}</td>
                          <td className="px-3 py-3 text-center font-semibold">
                            {r.manualAttendanceCount > 0 ? (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{r.manualAttendanceCount}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">₹{Number((r.grossSalary ?? 0) - Number(r.bonus ?? 0) - Number(r.allowances ?? 0)).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right text-red-600 font-semibold">-₹{Number(r.advanceDeduction ?? 0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-semibold">+₹{(Number(r.bonus ?? 0) + Number(r.allowances ?? 0)).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-right font-extrabold text-slate-800 dark:text-zinc-100">₹{Number(r.netSalary).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700 border-gray-200")}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/payroll/${r.id}`}>
                                <Button variant="outline" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                              </Link>
                              {canManage && r.status === "draft" && (
                                <>
                                  <Button variant="outline" size="icon" className="h-7 w-7 text-indigo-600 hover:text-indigo-700" onClick={() => startEdit(r)}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="outline" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                                    onClick={() => approvePayroll.mutate({ id: r.id }, { onSuccess: () => refetch() })}>
                                    <Check className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                              {canManage && r.status === "approved" && (
                                <Button variant="outline" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 bg-blue-50/50"
                                  onClick={() => handleMarkPaid(r.id)}>
                                  <DollarSign className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {canManage && (r.status === "approved" || r.status === "paid") && (
                                <Button variant="outline" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 bg-amber-50/50"
                                  onClick={() => handleSharePayslip(r.id)} title="Share with Employee">
                                  <Share2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!records?.length && (
                      <tr>
                        <td colSpan={17} className="px-4 py-16 text-center text-muted-foreground">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="font-semibold text-sm">No payroll records generated</p>
                          <p className="text-xs mt-0.5">Select filters above and click "Generate Payroll" to calculate payouts</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* 2. Reports Tab Content */}
        <TabsContent value="reports" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Sidebar list of reports */}
            <div className="md:col-span-1 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Available Reports</p>
              {[
                { id: "summary", label: "Monthly Summary" },
                { id: "branch", label: "Branch Cost Report" },
                { id: "history", label: "Salary History" },
                { id: "advance", label: "Advance Recovery" },
                { id: "correction", label: "Corrections Audit" },
                { id: "expense", label: "Salary Expense Summary" },
              ].map(report => (
                <button
                  key={report.id}
                  onClick={() => setActiveReportTab(report.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition border",
                    activeReportTab === report.id
                      ? "bg-primary text-primary-foreground border-primary/20 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 border-transparent"
                  )}
                >
                  {report.label}
                </button>
              ))}
            </div>

            {/* Reports Display and Filters */}
            <div className="md:col-span-3 space-y-4">
              
              {/* Dynamic Filters per report */}
              <Card className="p-4 border shadow-sm flex flex-wrap gap-4 items-end">
                {["summary", "branch", "correction", "expense"].includes(activeReportTab) && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Select Month</Label>
                    <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-40 h-9" />
                  </div>
                )}

                {activeReportTab === "history" && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Select Employee</Label>
                    <Select value={reportEmployeeId} onValueChange={setReportEmployeeId}>
                      <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Choose employee" /></SelectTrigger>
                      <SelectContent>
                        {employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName} ({e.employeeId})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex-1 flex justify-end">
                  {activeReportTab === "summary" && <Button size="sm" variant="outline" className="gap-2" onClick={exportSummaryReport}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                  {activeReportTab === "branch" && <Button size="sm" variant="outline" className="gap-2" onClick={exportBranchReport}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                  {activeReportTab === "history" && <Button size="sm" variant="outline" className="gap-2" onClick={exportHistoryReport} disabled={reportEmployeeId === "all"}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                  {activeReportTab === "advance" && <Button size="sm" variant="outline" className="gap-2" onClick={exportAdvanceReport}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                  {activeReportTab === "correction" && <Button size="sm" variant="outline" className="gap-2" onClick={exportCorrectionReport}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                  {activeReportTab === "expense" && <Button size="sm" variant="outline" className="gap-2" onClick={exportExpenseReport}><Download className="w-3.5 h-3.5" />Export Excel</Button>}
                </div>
              </Card>

              {/* REPORT DISPLAY PANELS */}

              {/* Report 1: Monthly Summary */}
              {activeReportTab === "summary" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Monthly Payroll Summary - {reportMonth}</h3>
                    <p className="text-[10px] text-muted-foreground">List of all calculated employee salaries for the selected month</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Employee</th>
                          <th className="text-left p-2 font-semibold">Branch</th>
                          <th className="text-right p-2 font-semibold">Monthly Rate</th>
                          <th className="text-right p-2 font-semibold">Payable Days</th>
                          <th className="text-right p-2 font-semibold">Gross Earned</th>
                          <th className="text-right p-2 font-semibold">Advance Recovery</th>
                          <th className="text-right p-2 font-semibold">Net Payout</th>
                          <th className="text-center p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRecords.map(r => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2 font-medium">{r.employeeName}</td>
                            <td className="p-2 text-muted-foreground">{r.branchName ?? "Main"}</td>
                            <td className="p-2 text-right">₹{Number(r.basicSalary).toLocaleString()}</td>
                            <td className="p-2 text-center text-primary font-medium">{r.workingDays}</td>
                            <td className="p-2 text-right font-medium">₹{Number(r.grossSalary).toLocaleString()}</td>
                            <td className="p-2 text-right text-red-600">-₹{Number(r.advanceDeduction).toLocaleString()}</td>
                            <td className="p-2 text-right font-bold text-green-700">₹{Number(r.netSalary).toLocaleString()}</td>
                            <td className="p-2 text-center capitalize">{r.status}</td>
                          </tr>
                        ))}
                        {!reportRecords.length && (
                          <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No salary records generated for {reportMonth}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Report 2: Branch Cost Report */}
              {activeReportTab === "branch" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Branch-wise Salary Report - {reportMonth}</h3>
                    <p className="text-[10px] text-muted-foreground">Aggregated salary distribution cost per physical branch</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Branch Name</th>
                          <th className="text-center p-2 font-semibold">Employee Count</th>
                          <th className="text-right p-2 font-semibold">Total Basic Rate</th>
                          <th className="text-right p-2 font-semibold">Total Gross Earned</th>
                          <th className="text-right p-2 font-semibold">Total Advance Ded.</th>
                          <th className="text-right p-2 font-semibold">Total Net Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchReportRows.map(b => (
                          <tr key={b.branchName} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2 font-bold">{b.branchName}</td>
                            <td className="p-2 text-center text-primary font-medium">{b.count}</td>
                            <td className="p-2 text-right">₹{b.basic.toLocaleString()}</td>
                            <td className="p-2 text-right">₹{b.gross.toLocaleString()}</td>
                            <td className="p-2 text-right text-red-600">-₹{b.advance.toLocaleString()}</td>
                            <td className="p-2 text-right font-extrabold text-slate-800 dark:text-zinc-200">₹{b.net.toLocaleString()}</td>
                          </tr>
                        ))}
                        {!branchReportRows.length && (
                          <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No branch data available for {reportMonth}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Report 3: Salary History */}
              {activeReportTab === "history" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Employee Salary History</h3>
                    <p className="text-[10px] text-muted-foreground">View historical payouts and adjustments for {historyEmp ? `${historyEmp.firstName} ${historyEmp.lastName}` : "selected employee"}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Month</th>
                          <th className="text-right p-2 font-semibold">Monthly Rate</th>
                          <th className="text-right p-2 font-semibold">Payable Days</th>
                          <th className="text-right p-2 font-semibold">Gross Earned</th>
                          <th className="text-right p-2 font-semibold">Advance Deduction</th>
                          <th className="text-right p-2 font-semibold">Net Payout</th>
                          <th className="text-center p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeHistoryRecords.map(r => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2 font-medium">{r.month}</td>
                            <td className="p-2 text-right">₹{Number(r.basicSalary).toLocaleString()}</td>
                            <td className="p-2 text-center">{r.workingDays}</td>
                            <td className="p-2 text-right">₹{Number(r.grossSalary).toLocaleString()}</td>
                            <td className="p-2 text-right text-red-600">-₹{Number(r.advanceDeduction).toLocaleString()}</td>
                            <td className="p-2 text-right font-bold text-green-700">₹{Number(r.netSalary).toLocaleString()}</td>
                            <td className="p-2 text-center capitalize">{r.status}</td>
                          </tr>
                        ))}
                        {!employeeHistoryRecords.length && (
                          <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Choose an employee or no matching history found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Report 4: Advance Recovery Report */}
              {activeReportTab === "advance" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold">Advance Recovery Report</h3>
                      <p className="text-[10px] text-muted-foreground">Monitor outstanding balances and recovery progress from monthly cycles</p>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
                      <div>Total Disbursed: <span className="font-bold text-foreground">₹{totalAdvancesGiven.toLocaleString()}</span></div>
                      <div>Total Recovered: <span className="font-bold text-green-700">₹{totalAdvancesRecovered.toLocaleString()}</span></div>
                      <div>Total Outstanding: <span className="font-bold text-red-600">₹{totalAdvancesOutstanding.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Employee</th>
                          <th className="text-left p-2 font-semibold">Date Disbursed</th>
                          <th className="text-right p-2 font-semibold">Approved Advance</th>
                          <th className="text-right p-2 font-semibold">Total Recovered</th>
                          <th className="text-right p-2 font-semibold">Remaining Balance</th>
                          <th className="text-left p-2 font-semibold">Reason</th>
                          <th className="text-center p-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {advanceReportRows.map((a, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2">
                              <div className="font-medium">{a.employeeName}</div>
                              <div className="text-[10px] text-muted-foreground">{a.employeeCode}</div>
                            </td>
                            <td className="p-2 text-muted-foreground">{a.date}</td>
                            <td className="p-2 text-right">₹{a.amount.toLocaleString()}</td>
                            <td className="p-2 text-right text-green-700">₹{a.recovered.toLocaleString()}</td>
                            <td className="p-2 text-right font-bold text-red-600">₹{a.remaining.toLocaleString()}</td>
                            <td className="p-2 text-muted-foreground max-w-xxs truncate" title={a.reason}>{a.reason}</td>
                            <td className="p-2 text-center capitalize">{a.status}</td>
                          </tr>
                        ))}
                        {!advanceReportRows.length && (
                          <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No salary advances records found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Report 5: Attendance Correction Report */}
              {activeReportTab === "correction" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Attendance Correction Report - {reportMonth}</h3>
                    <p className="text-[10px] text-muted-foreground">Audit logs tracking manual updates performed by HR and Admins</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Employee</th>
                          <th className="text-left p-2 font-semibold">Attendance Date</th>
                          <th className="text-center p-2 font-semibold">New Status</th>
                          <th className="text-left p-2 font-semibold">Reason for manual entry</th>
                          <th className="text-left p-2 font-semibold">Marked By</th>
                          <th className="text-left p-2 font-semibold">Date Marked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {correctionLogs.map(c => (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2">
                              <div className="font-medium">{c.employeeName}</div>
                              <div className="text-[10px] text-muted-foreground">{c.employeeCode}</div>
                            </td>
                            <td className="p-2 text-muted-foreground">{c.date}</td>
                            <td className="p-2 text-center">
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold capitalize">{c.status}</span>
                            </td>
                            <td className="p-2 text-muted-foreground">{c.reason}</td>
                            <td className="p-2 font-medium">{c.modifiedBy}</td>
                            <td className="p-2 text-muted-foreground">{c.modifiedAt}</td>
                          </tr>
                        ))}
                        {!correctionLogs.length && (
                          <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No manual corrections logged for {reportMonth}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Report 6: Total Salary Expense Summary */}
              {activeReportTab === "expense" && (
                <Card className="border shadow-sm overflow-hidden p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold">Total Salary Expense Summary</h3>
                    <p className="text-[10px] text-muted-foreground">Month-by-month financial payroll expense summary</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-slate-50 dark:bg-zinc-800/40">
                          <th className="text-left p-2 font-semibold">Month</th>
                          <th className="text-center p-2 font-semibold">Paid Employees Count</th>
                          <th className="text-right p-2 font-semibold">Total Contractual Rates</th>
                          <th className="text-right p-2 font-semibold">Total Gross Earned</th>
                          <th className="text-right p-2 font-semibold">Total Advance Recovery</th>
                          <th className="text-right p-2 font-semibold">Total Net Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b hover:bg-muted/20">
                          <td className="p-3 font-bold text-primary">{expenseSummary.month}</td>
                          <td className="p-3 text-center font-semibold">{expenseSummary.employeeCount}</td>
                          <td className="p-3 text-right">₹{expenseSummary.totalBasic.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium">₹{expenseSummary.totalGross.toLocaleString()}</td>
                          <td className="p-3 text-right text-red-600">-₹{expenseSummary.totalDeductions.toLocaleString()}</td>
                          <td className="p-3 text-right font-extrabold text-slate-800 dark:text-zinc-200">₹{expenseSummary.totalNet.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjustments edit dialog */}
      <Dialog open={editingRecord !== null} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Payroll Adjustments</DialogTitle>
          </DialogHeader>
          {editingRecord && (
            <div className="space-y-4 py-3">
              <div>
                <Label className="text-muted-foreground">Employee Name</Label>
                <p className="text-sm font-semibold mt-1">{editingRecord.employeeName}</p>
              </div>

              <div>
                <Label>Allowances (₹)</Label>
                <Input type="number" value={allowanceInput} onChange={e => setAllowanceInput(e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label>Bonus (₹)</Label>
                <Input type="number" value={bonusInput} onChange={e => setBonusInput(e.target.value)} className="mt-1" />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setEditingRecord(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={updateRecord.isPending}>
                  {updateRecord.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
