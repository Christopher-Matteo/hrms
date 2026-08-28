import { useState } from "react";
import { 
  useGetLeaveRequests, 
  useCreateLeaveRequest, 
  useUpdateLeaveRequest, 
  useDeleteLeaveRequest, 
  useApproveLeave, 
  useRejectLeave, 
  useGetEmployees 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, X, Calendar, Download, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const LEAVE_TYPES = ["casual", "sick", "earned", "emergency", "loss_of_pay", "maternity", "paternity"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  casual: "bg-blue-50 text-blue-700 border-blue-100",
  sick: "bg-orange-50 text-orange-700 border-orange-100",
  earned: "bg-purple-50 text-purple-700 border-purple-100",
  emergency: "bg-red-50 text-red-700 border-red-100",
  loss_of_pay: "bg-zinc-50 text-zinc-700 border-zinc-100",
  maternity: "bg-pink-50 text-pink-700 border-pink-100",
  paternity: "bg-indigo-50 text-indigo-700 border-indigo-100",
};

export default function LeavesPage() {
  const { user } = useAuth();
  const { data: employees } = useGetEmployees();
  const { data: leaves, isLoading, refetch } = useGetLeaveRequests();
  const createLeave = useCreateLeaveRequest();
  const updateLeave = useUpdateLeaveRequest();
  const deleteLeave = useDeleteLeaveRequest();
  const approveLeave = useApproveLeave();
  const rejectLeave = useRejectLeave();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [editingLeaveId, setEditingLeaveId] = useState<number | null>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  });
  const [selectedEmp, setSelectedEmp] = useState("all");

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
    if (editingLeaveId !== null) {
      updateLeave.mutate(
        { id: editingLeaveId, data: { ...form, employeeId: Number(form.employeeId) } as any },
        {
          onSuccess: () => {
            refetch();
            setOpen(false);
            setEditingLeaveId(null);
            setForm({
              employeeId: "",
              leaveType: "casual",
              startDate: "",
              endDate: "",
              reason: "",
              informed: "informed",
              salaryCalculate: "calculate",
            });
          },
        }
      );
    } else {
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
  }

  function handleEditClick(l: any) {
    setEditingLeaveId(l.id);
    setForm({
      employeeId: String(l.employeeId),
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      informed: l.informed || "informed",
      salaryCalculate: l.salaryCalculate || "calculate",
    });
    setOpen(true);
  }

  function handleDelete(id: number) {
    if (!window.confirm("Are you sure you want to delete this leave request? This will also remove any manual attendance entries generated for this leave.")) return;
    deleteLeave.mutate(
      { id },
      {
        onSuccess: () => {
          refetch();
          setOpen(false);
          setEditingLeaveId(null);
          setForm({
            employeeId: "",
            leaveType: "casual",
            startDate: "",
            endDate: "",
            reason: "",
            informed: "informed",
            salaryCalculate: "calculate",
          });
        },
      }
    );
  }

  function handleApprove(id: number) {
    approveLeave.mutate(
      { id, data: { comment: "Approved by manager" } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }

  // Fallback approval comment is required by spec/zod
  function handleReject(id: number) {
    rejectLeave.mutate(
      { id, data: { comment: "Rejected by manager" } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }

  function shiftMonth(offset: number) {
    const [year, m] = currentMonth.split("-").map(Number);
    const d = new Date(year, m - 1 + offset, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
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

  // Calendar Math
  const [year, monthVal] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, monthVal, 0).getDate();
  const firstDayIndex = new Date(year, monthVal - 1, 1).getDay();
  const calendarCells = [...Array(firstDayIndex).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

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
          <Dialog open={open} onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditingLeaveId(null);
              setForm({
                employeeId: "",
                leaveType: "casual",
                startDate: "",
                endDate: "",
                reason: "",
                informed: "informed",
                salaryCalculate: "calculate",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Leave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLeaveId !== null ? "Edit Leave Record" : "Create Leave Record"}</DialogTitle>
              </DialogHeader>
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
                
                <div className="flex gap-2 justify-between mt-6">
                  {editingLeaveId !== null ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleDelete(editingLeaveId)}
                      disabled={deleteLeave.isPending}
                    >
                      Delete Leave
                    </Button>
                  ) : (
                    <div />
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createLeave.isPending || updateLeave.isPending}>
                      {editingLeaveId !== null ? "Save Changes" : "Add Leave"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-80 grid-cols-2">
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="w-4 h-4" />Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
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
                      {canManage && <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground w-40">Actions</th>}
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
                               l.salaryCalculate === "calculate" ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                             )}>
                              {l.salaryCalculate === "calculate" ? "Paid" : "Unpaid"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{l.startDate} → {l.endDate}</td>
                        <td className="px-4 py-3 text-center font-medium">{l.days}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{l.reason}</td>
                        {canManage && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200"
                                onClick={() => handleEditClick(l)}
                                title="Edit Leave"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-7 h-7 text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                                onClick={() => handleDelete(l.id)}
                                title="Delete Leave"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!leaves?.length && (
                      <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-12 text-center text-muted-foreground">
                        <Calendar className="w-8 h-8 mx-auto mb-2" />
                        No leave requests found
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => shiftMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
                <Input
                  type="month"
                  value={currentMonth}
                  onChange={e => e.target.value && setCurrentMonth(e.target.value)}
                  className="w-40 h-8 font-medium"
                />
                <Button size="icon" variant="outline" className="w-8 h-8" onClick={() => shiftMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Filter Employee:</span>
                <Select value={selectedEmp} onValueChange={setSelectedEmp}>
                  <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <Card className="p-4">
                <div className="grid grid-cols-7 gap-2 mb-2 text-center font-semibold text-xs text-muted-foreground border-b pb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day}>{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarCells.map((cellDay, idx) => {
                    if (cellDay === null) {
                      return <div key={`empty-${idx}`} className="bg-muted/10 rounded-md min-h-[90px]" />;
                    }

                    const dateStr = `${year}-${String(monthVal).padStart(2, "0")}-${String(cellDay).padStart(2, "0")}`;
                    
                    // Filter leaves active on this specific date
                    const activeLeavesOnDay = leaves?.filter(l => {
                      if (selectedEmp !== "all" && String(l.employeeId) !== selectedEmp) return false;
                      return dateStr >= l.startDate && dateStr <= l.endDate;
                    }) ?? [];

                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          const clickedDate = dateStr;
                          setForm(prev => ({
                            ...prev,
                            startDate: clickedDate,
                            endDate: clickedDate,
                            employeeId: selectedEmp !== "all" ? selectedEmp : prev.employeeId,
                          }));
                          setOpen(true);
                        }}
                        className="border border-border hover:bg-muted/40 transition-colors p-2 rounded-md min-h-[95px] flex flex-col justify-between cursor-pointer relative group"
                        title="Click to mark leave on this day"
                      >
                        <span className="absolute top-1 right-2 text-xs font-bold text-muted-foreground group-hover:text-foreground">
                          {cellDay}
                        </span>

                        <div className="mt-4 space-y-1 w-full overflow-hidden">
                          {activeLeavesOnDay.slice(0, 3).map(l => (
                            <div
                              key={l.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(l);
                              }}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded border truncate font-medium hover:brightness-95 active:scale-95 transition-all",
                                LEAVE_TYPE_COLORS[l.leaveType] ?? "bg-zinc-50 text-zinc-700 border-zinc-100",
                                l.status === "pending" && "opacity-75 border-dashed"
                              )}
                              title={`Click to edit: ${l.employeeName} (${l.leaveType.replace(/_/g, " ")}) - ${l.status}`}
                            >
                              {l.employeeName?.split(" ")[0]} ({l.leaveType.replace(/_/g, " ").substring(0, 4)}.)
                            </div>
                          ))}
                          {activeLeavesOnDay.length > 3 && (
                            <div className="text-[9px] text-muted-foreground text-center font-medium">
                              +{activeLeavesOnDay.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
