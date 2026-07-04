import { useState } from "react";
import { useGetLeaveRequests, useCreateLeaveRequest, useApproveLeave, useRejectLeave, useGetEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, X, Calendar } from "lucide-react";
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
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: leaves, isLoading, refetch } = useGetLeaveRequests({
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const createLeave = useCreateLeaveRequest();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", leaveType: "casual", startDate: "", endDate: "", reason: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createLeave.mutate({ data: { ...form, employeeId: Number(form.employeeId) } as any }, {
      onSuccess: () => { refetch(); setOpen(false); }
    });
  }

  const canManage = ["super_admin", "hr_manager", "branch_manager"].includes(user?.role ?? "");
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">{leaves?.length ?? 0} requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Leave Request</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leave Type *</Label>
                <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date *</Label><Input className="mt-1" type="date" value={form.startDate} onChange={set("startDate")} required /></div>
                <div><Label>End Date *</Label><Input className="mt-1" type="date" value={form.endDate} onChange={set("endDate")} required /></div>
              </div>
              <div><Label>Reason *</Label><Input className="mt-1" value={form.reason} onChange={set("reason")} required /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createLeave.isPending}>Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Dates</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reason</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  {canManage && <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {leaves?.map(l => (
                  <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.employeeName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{l.leaveType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.startDate} → {l.endDate}</td>
                    <td className="px-4 py-3 text-center font-medium">{l.days}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{l.reason}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[l.status] ?? "bg-gray-100 text-gray-700")}>
                        {l.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {l.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                              onClick={() => approveLeave.mutate({ id: l.id, data: {} as any }, { onSuccess: () => refetch() })}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => rejectLeave.mutate({ id: l.id, data: {} as any }, { onSuccess: () => refetch() })}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!leaves?.length && (
                  <tr><td colSpan={canManage ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground">
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
