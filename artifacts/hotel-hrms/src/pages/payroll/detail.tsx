import { useRoute, Link } from "wouter";
import { useGetPayrollRecord } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-blue-100 text-blue-700",
};

export default function PayslipPage() {
  const [, params] = useRoute("/payroll/:id");
  const id = Number(params?.id);
  const { data: record, isLoading } = useGetPayrollRecord(id);

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!record) return <div className="text-center py-12 text-muted-foreground">Payroll record not found</div>;

  const EarningRow = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">₹{value.toLocaleString("en-IN")}</span>
    </div>
  );

  const DeductionRow = ({ label, value }: { label: string; value: number }) => (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-red-600">-₹{value.toLocaleString("en-IN")}</span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/payroll">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Payslip</h1>
            <p className="text-sm text-muted-foreground">{record.employeeName} · {record.month}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />Print
        </Button>
      </div>

      {/* Payslip card */}
      <div className="border border-border rounded-xl overflow-hidden bg-card print:shadow-none" id="payslip">
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-bold">Red Fox Hotel</div>
              <div className="text-primary-foreground/80 text-sm">HR Management System</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">PAYSLIP</div>
              <div className="text-primary-foreground/80 text-sm">{record.month}</div>
              <span className={cn("mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white")}>{record.status}</span>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Employee Name</p><p className="font-semibold text-sm">{record.employeeName}</p></div>
            <div><p className="text-xs text-muted-foreground">Employee ID</p><p className="font-medium text-sm">{record.employeeCode}</p></div>
            <div><p className="text-xs text-muted-foreground">Department</p><p className="font-medium text-sm">{record.department}</p></div>
            <div><p className="text-xs text-muted-foreground">Branch</p><p className="font-medium text-sm">{record.branchName ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Month</p><p className="font-medium text-sm">{record.month}</p></div>
            <div><p className="text-xs text-muted-foreground">Working Days</p><p className="font-medium text-sm">{record.workingDays} / {record.expectedWorkingDays}</p></div>
          </div>
        </div>

        {/* Attendance summary */}
        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-3">ATTENDANCE SUMMARY</p>
          <div className="grid grid-cols-6 gap-3 text-center">
            {[
              { label: "Present", value: record.presentDays },
              { label: "Absent", value: record.absentDays },
              { label: "Weekly Off", value: record.weeklyOffDays },
              { label: "Leave", value: record.leaveDays },
              { label: "Cont. Duty", value: record.continueDutyDays },
              { label: "OT Hours", value: `${record.overtimeHours}h` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-md p-2">
                <div className="text-sm font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings and Deductions */}
        <div className="px-6 py-4 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3">EARNINGS</p>
            <EarningRow label="Basic Salary" value={Number(record.basicSalary)} />
            {Number(record.overtimeAmount) > 0 && <EarningRow label="Overtime" value={Number(record.overtimeAmount)} />}
            {Number(record.continueDutyAmount) > 0 && <EarningRow label="Continue Duty" value={Number(record.continueDutyAmount)} />}
            {Number(record.bonus) > 0 && <EarningRow label="Bonus" value={Number(record.bonus)} />}
            {Number(record.allowances) > 0 && <EarningRow label="Allowances" value={Number(record.allowances)} />}
            <div className="flex justify-between pt-3 mt-1 border-t border-border">
              <span className="text-sm font-semibold">Gross Salary</span>
              <span className="text-sm font-bold">₹{Number(record.grossSalary).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3">DEDUCTIONS</p>
            {Number(record.absentDeduction) > 0 && <DeductionRow label="Absent Deduction" value={Number(record.absentDeduction)} />}
            {Number(record.lateDeduction) > 0 && <DeductionRow label="Late Deduction" value={Number(record.lateDeduction)} />}
            {Number(record.advanceDeduction) > 0 && <DeductionRow label="Advance Recovery" value={Number(record.advanceDeduction)} />}
            <div className="flex justify-between pt-3 mt-1 border-t border-border">
              <span className="text-sm font-semibold">Total Deductions</span>
              <span className="text-sm font-bold text-red-600">-₹{Number(record.totalDeductions).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Net Salary */}
        <div className="mx-6 mb-6 bg-primary/5 border border-primary/20 rounded-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">NET SALARY</p>
              <p className="text-xs text-muted-foreground mt-0.5">Gross - Total Deductions</p>
            </div>
            <p className="text-3xl font-bold text-primary">₹{Number(record.netSalary).toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
