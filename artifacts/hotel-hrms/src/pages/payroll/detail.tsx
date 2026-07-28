import { useRoute, Link } from "wouter";
import { useGetPayrollRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400",
  paid: "bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400",
};

export default function PayslipPage() {
  const [, params] = useRoute("/payroll/:id");
  const id = Number(params?.id);
  const { data: record, isLoading } = useGetPayrollRecord(id);

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!record) return <div className="text-center py-12 text-muted-foreground">Payroll record not found</div>;

  const basicSalary = Number(record.basicSalary);
  const expectedDays = Number(record.expectedWorkingDays) || 30;
  const dailySalary = basicSalary / expectedDays;
  
  // Base earned salary (Daily Salary * Payable Days)
  const earnedSalary = dailySalary * Number(record.workingDays);

  const EarningRow = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );

  const DeductionRow = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-red-600">-₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );

  async function handleShare() {
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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/payroll">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Payslip Summary</h1>
            <p className="text-sm text-muted-foreground">{record.employeeName} · {record.month}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50" onClick={handleShare}>
            <Share2 className="w-4 h-4" />Share with Employee
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Payslip Card for display and print */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm print:border-0 print:shadow-none" id="payslip">
        {/* Corporate header block */}
        <div className="bg-primary px-8 py-6 text-white flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12c0,0.32,0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              <span className="text-xl font-bold tracking-tight">Red Fox Hotel</span>
            </div>
            <p className="text-primary-foreground/75 text-xs">Payroll Management Systems & HR Portal</p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-xs uppercase font-extrabold tracking-widest text-primary-foreground/90">Salary Payslip</div>
            <div className="text-sm font-semibold">{record.month}</div>
            <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border border-white/20 bg-white/10")}>
              {record.status}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-zinc-800/20">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs">
            <div><p className="text-muted-foreground font-semibold">Employee Name</p><p className="font-bold text-sm mt-0.5 text-slate-800 dark:text-zinc-200">{record.employeeName}</p></div>
            <div><p className="text-muted-foreground font-semibold">Employee ID</p><p className="font-medium text-sm mt-0.5">{record.employeeCode}</p></div>
            <div><p className="text-muted-foreground font-semibold">Department</p><p className="font-medium text-sm mt-0.5">{record.department}</p></div>
            <div><p className="text-muted-foreground font-semibold">Branch</p><p className="font-medium text-sm mt-0.5">{record.branchName ?? "Main Branch"}</p></div>
            <div><p className="text-muted-foreground font-semibold">Pay Period</p><p className="font-medium text-sm mt-0.5">{record.month}</p></div>
            <div><p className="text-muted-foreground font-semibold">Monthly Rate</p><p className="font-medium text-sm mt-0.5">₹{basicSalary.toLocaleString("en-IN")}</p></div>
          </div>
        </div>

        {/* Attendance details */}
        <div className="px-8 py-5 border-b border-border">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3.5">Attendance Summary</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            {[
              { label: "Payable Days", value: record.workingDays, highlight: "text-primary font-extrabold" },
              { label: "Present Days", value: record.presentDays },
              { label: "Leaves taken", value: record.leaveDays },
              { label: "Weekly Off", value: record.weeklyOffDays },
              { label: "Absent Days", value: record.absentDays, highlight: "text-red-600 font-bold" },
              { label: "Manual Entries", value: record.manualAttendanceCount, highlight: record.manualAttendanceCount > 0 ? "text-amber-700 font-bold" : "" },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="bg-muted/40 rounded-lg p-2.5 border border-muted-foreground/10">
                <div className={cn("text-base font-semibold", highlight)}>{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Calculations detailed rows */}
        <div className="px-8 py-5 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Earnings */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-2 mb-3">Earnings</p>
            <div className="space-y-1">
              <EarningRow label="Earned Salary (Daily Rate × Payable Days)" value={earnedSalary} />
              {Number(record.overtimeAmount) > 0 && (
                <EarningRow label={`Overtime Pay (${Number(record.overtimeHours)} hrs)`} value={Number(record.overtimeAmount)} />
              )}
              {Number(record.continueDutyAmount) > 0 && (
                <EarningRow label={`Continue Duty Pay (${Number(record.continueDutyDays)} days)`} value={Number(record.continueDutyAmount)} />
              )}
              {Number(record.bonus) > 0 && <EarningRow label="Performance Bonus" value={Number(record.bonus)} />}
              {Number(record.allowances) > 0 && <EarningRow label="Allowances" value={Number(record.allowances)} />}
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-border/80">
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Gross Salary</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">₹{Number(record.grossSalary).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b pb-2 mb-3">Deductions</p>
            <div className="space-y-1">
              {Number(record.advanceDeduction) > 0 && (
                <DeductionRow label="Salary Advance Deduction" value={Number(record.advanceDeduction)} />
              )}
              {Number(record.lateDeduction) > 0 && (
                <DeductionRow label="Late Attendance Deduction" value={Number(record.lateDeduction)} />
              )}
              {Number(record.advanceDeduction) <= 0 && Number(record.lateDeduction) <= 0 && (
                <p className="text-xs text-muted-foreground py-2 italic">No deductions applied.</p>
              )}
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-border/80">
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">Total Deductions</span>
              <span className="text-sm font-extrabold text-red-600">-₹{Number(record.totalDeductions).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Net payout row */}
        <div className="mx-8 mb-8 mt-2 bg-primary/5 border border-primary/20 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Net Payable Salary</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Gross Earned Payout - Total Deductions</p>
          </div>
          <p className="text-3xl font-extrabold text-primary">₹{Number(record.netSalary).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>
    </div>
  );
}
