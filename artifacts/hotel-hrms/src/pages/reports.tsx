import { useState } from "react";
import { useGetAttendanceReport, useGetPayrollReport, useGetLeaveReport, useGetBranches } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";

function AttendanceReport() {
  const { data: branches } = useGetBranches();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("all");
  const { data: report, isLoading } = useGetAttendanceReport({
    month: month || undefined,
    branchId: branchFilter !== "all" ? Number(branchFilter) : undefined,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Employee", "Department", "Branch", "Present", "Absent", "W/Off", "Leave", "Late", "OT Hours", "Work Hrs"].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report?.map((r: any) => (
                  <tr key={r.employeeId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-xs">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.department}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.branchName}</td>
                    <td className="px-3 py-2.5 text-xs text-green-700 font-medium">{r.presentDays}</td>
                    <td className="px-3 py-2.5 text-xs text-red-600 font-medium">{r.absentDays}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.weeklyOffDays}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.leaveDays}</td>
                    <td className="px-3 py-2.5 text-xs text-amber-600">{r.lateDays}</td>
                    <td className="px-3 py-2.5 text-xs text-teal-600">{r.overtimeHours.toFixed(1)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.workingHours.toFixed(1)}</td>
                  </tr>
                ))}
                {!report?.length && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">No data for selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PayrollReport() {
  const { data: branches } = useGetBranches();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("all");
  const { data: report, isLoading } = useGetPayrollReport({
    month: month || undefined,
    branchId: branchFilter !== "all" ? Number(branchFilter) : undefined,
  });

  const totalNet = report?.reduce((s: number, r: any) => s + Number(r.netSalary), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {report && report.length > 0 && (
        <div className="text-sm text-muted-foreground">Total Net Salary: <span className="font-bold text-foreground">₹{totalNet.toLocaleString("en-IN")}</span></div>
      )}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Employee", "Department", "Branch", "Basic Salary", "Gross Salary", "Deductions", "Net Salary", "Status"].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report?.map((r: any) => (
                  <tr key={r.employeeId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-xs">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.department}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.branchName}</td>
                    <td className="px-3 py-2.5 text-xs">₹{Number(r.basicSalary).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-xs">₹{Number(r.grossSalary).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-xs text-red-600">-₹{Number(r.totalDeductions).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-xs font-bold text-green-700">₹{Number(r.netSalary).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2.5 text-xs capitalize">{r.status}</td>
                  </tr>
                ))}
                {!report?.length && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">No payroll data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function LeaveReport() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data: report, isLoading } = useGetLeaveReport({ month: month || undefined });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Employee", "Department", "Casual", "Sick", "Earned", "LOP", "Total", "Pending", "Approved"].map(h => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report?.map((r: any) => (
                  <tr key={r.employeeId} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-xs">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.department}</td>
                    <td className="px-3 py-2.5 text-xs">{r.casualLeaves}</td>
                    <td className="px-3 py-2.5 text-xs">{r.sickLeaves}</td>
                    <td className="px-3 py-2.5 text-xs">{r.earnedLeaves}</td>
                    <td className="px-3 py-2.5 text-xs text-red-600">{r.lossOfPayLeaves}</td>
                    <td className="px-3 py-2.5 text-xs font-medium">{r.totalLeaves}</td>
                    <td className="px-3 py-2.5 text-xs text-yellow-600">{r.pendingLeaves}</td>
                    <td className="px-3 py-2.5 text-xs text-green-600">{r.approvedLeaves}</td>
                  </tr>
                ))}
                {!report?.length && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">No leave data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and view monthly reports</p>
      </div>
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance" className="mt-4"><AttendanceReport /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollReport /></TabsContent>
        <TabsContent value="leave" className="mt-4"><LeaveReport /></TabsContent>
      </Tabs>
    </div>
  );
}
