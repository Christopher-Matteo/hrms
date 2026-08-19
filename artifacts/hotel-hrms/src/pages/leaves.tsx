import { useState } from "react";
import { useGetLeaveRequests, useCreateLeaveRequest, useApproveLeave, useRejectLeave, useGetEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, X, Calendar, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const LEAVE_TYPES = ["casual", "sick", "earned", "emergency", "loss_of_pay", "maternity", "paternity"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function LeavesPage() {
  const { user } = useAuth();
  const { data: employees } = useGetEmployees();
  const { data: leaves, isLoading, refetch } = useGetLeaveRequests();
  const createLeave = useCreateLeaveRequest();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
    informed: "informed",
    salaryCalculate: "calculate",
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createLeave.mutate({ data: { ...form, employeeId: Number(form.employeeId) } as any }, {
      onSuccess: () => {
        refetch();
        setOpen(false);
        setForm({
          employeeId: "",
          leaveType: "casual",
          startDate: "",
          endDate: "",
          reason: "",
          informed: "informed",
          salaryCalculate: "calculate"
        });
      }
    });
  }

  function exportCSV() {
    if (!leaves?.length) return;
    const headers = [
      "Employee Name",
      "Employee Code",
      "Leave Type",
      "Informed",
      "Salary Calculate",
      "Start Date",
      "End Date",
      "Days",
      "Reason",
      "Status"
    ];
    
    const rows = leaves.map(l => [
      l.employeeName ?? "",
      l.employeeCode ?? "",
      l.leaveType,
      l.informed ?? "informed",
      l.salaryCalculate ?? "calculate",
      l.startDate,
      l.endDate,
      l.days,
      l.reason,
      l.status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leaves_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const canManage = ["super_admin", "hr_manager", "branch_manager"].includes(user?.role ?? "");
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Leave Management</h1>
          <p className="text-sm text-muted-foreground">{leaves?.length ?? 0} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCSV} disabled={!leaves?.length}>
            <Download className="w-4 h-4" />Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Leave Record</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Leave Type *</Label>
                  <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Informed State *</Label>
                  <Select value={form.informed} onValueChange={v => setForm(f => ({ ...f, informed: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="informed">Informed</SelectItem>
                      <SelectItem value="uninformed">Not Informed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Salary Calculation *</Label>
                <Select value={form.salaryCalculate} onValueChange={v => setForm(f => ({ ...f, salaryCalculate: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calculate">Calculate Salary (Paid)</SelectItem>
                    <SelectItem value="no_calculate">Do Not Calculate (Unpaid)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date *</Label><Input className="mt-1" type="date" value={form.startDate} onChange={set("startDate")} required /></div>
                <div><Label>End Date *</Label><Input className="mt-1" type="date" value={form.endDate} onChange={set("endDate")} required /></div>
              </div>
              <div><Label>Reason *</Label><Input className="mt-1" value={form.reason} onChange={set("reason")} required /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createLeave.isPending}>Add Leave</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>


      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Dates</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {leaves?.map(l => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.employeeName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      <div>{l.leaveType.replace(/_/g, " ")}</div>
                      <div className="text-[10px] flex items-center gap-1.5 mt-1 font-semibold">
                        <span className={cn(
                          "px-1.5 py-0.2 rounded border",
                          l.informed === "informed" ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                        )}>
                          {l.informed === "informed" ? "Informed" : "Uninformed"}
                        </span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded border",
                          l.salaryCalculate === "calculate" ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
                        )}>
                          {l.salaryCalculate === "calculate" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.startDate} → {l.endDate}</td>
                    <td className="px-4 py-3 text-center font-medium">{l.days}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{l.reason}</td>
                  </tr>
                ))}
                {!leaves?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Calendar className="w-8 h-8 mx-auto mb-2" />
                    No leave requests found
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
