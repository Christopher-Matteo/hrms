import { useState } from "react";
import { Link } from "wouter";
import { useGetPayrollRecords, useGeneratePayroll, useApprovePayroll, useGetBranches } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Play, Check, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-blue-100 text-blue-700",
};

export default function PayrollPage() {
  const { user } = useAuth();
  const { data: branches } = useGetBranches();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: records, isLoading, refetch } = useGetPayrollRecords({
    month: month || undefined,
    branchId: branchFilter !== "all" ? Number(branchFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const generatePayroll = useGeneratePayroll();
  const approvePayroll = useApprovePayroll();

  const canManage = ["super_admin", "hr_manager"].includes(user?.role ?? "");

  function handleGenerate() {
    if (!month) return;
    generatePayroll.mutate(
      { data: { month, branchId: branchFilter !== "all" ? Number(branchFilter) : undefined } as any },
      { onSuccess: () => refetch() }
    );
  }

  const totalNetSalary = records?.reduce((sum, r) => sum + Number(r.netSalary), 0) ?? 0;
  const totalGross = records?.reduce((sum, r) => sum + Number(r.grossSalary), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">{records?.length ?? 0} records · Net: ₹{totalNetSalary.toLocaleString("en-IN")}</p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generatePayroll.isPending}>
            <Play className="w-4 h-4" />
            {generatePayroll.isPending ? "Generating..." : "Generate Payroll"}
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {records && records.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Gross", value: `₹${totalGross.toLocaleString("en-IN")}` },
            { label: "Total Deductions", value: `₹${records.reduce((s, r) => s + Number(r.totalDeductions), 0).toLocaleString("en-IN")}` },
            { label: "Total Net Salary", value: `₹${totalNetSalary.toLocaleString("en-IN")}` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold mt-0.5">{value}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Department</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Basic</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Gross</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Deductions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Net Salary</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records?.map(r => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.department}</td>
                    <td className="px-4 py-3 text-right">₹{Number(r.basicSalary).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right">₹{Number(r.grossSalary).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-red-600">-₹{Number(r.totalDeductions).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">₹{Number(r.netSalary).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700")}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/payroll/${r.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        {canManage && r.status === "draft" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600"
                            onClick={() => approvePayroll.mutate({ id: r.id }, { onSuccess: () => refetch() })}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!records?.length && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <DollarSign className="w-8 h-8 mx-auto mb-2" />
                    No payroll records. Click "Generate Payroll" to create records for {month}.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
