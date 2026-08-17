import { useState } from "react";
import { useGetAttendanceRecords, useCreateAttendanceRecord, useGetEmployees, useGetAttendanceCalendar } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Filter, UserCheck, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const BASE = (import.meta as any).env.VITE_API_URL ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  weekly_off: "bg-blue-100 text-blue-700",
  public_holiday: "bg-purple-100 text-purple-700",
  paid_leave: "bg-yellow-100 text-yellow-700",
  sick_leave: "bg-orange-100 text-orange-700",
  half_day: "bg-cyan-100 text-cyan-700",
  late: "bg-amber-100 text-amber-700",
  overtime: "bg-teal-100 text-teal-700",
  continue_duty: "bg-indigo-100 text-indigo-700",
};

const CALENDAR_COLORS: Record<string, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  weekly_off: "bg-blue-500",
  public_holiday: "bg-purple-500",
  paid_leave: "bg-yellow-500",
  sick_leave: "bg-orange-500",
  half_day: "bg-cyan-500",
  late: "bg-amber-500",
  overtime: "bg-teal-500",
  continue_duty: "bg-indigo-500",
};

const STATUSES = ["present", "absent", "weekly_off", "public_holiday", "paid_leave", "sick_leave", "half_day", "late", "overtime", "continue_duty"];

function CalendarView() {
  const { data: employees } = useGetEmployees();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data: calendar } = useGetAttendanceCalendar(
    { employeeId: selectedEmployee ? Number(selectedEmployee) : undefined, month: month || undefined } as any
  );

  const [year, m] = month.split("-").map(Number);
  const daysInMonth = new Date(year, m, 0).getDate();
  const firstDay = new Date(year, m - 1, 1).getDay();
  const calMap = new Map((calendar ?? []).map((r: any) => [r.date, r]));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40" />
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Select employee" /></SelectTrigger>
          <SelectContent>
            {employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName} ({e.employeeId})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedEmployee ? (
        <Card>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const record = calMap.get(dateStr) as any;
                return (
                  <div key={day} className={cn("aspect-square flex flex-col items-center justify-center rounded-md text-xs", record ? "" : "bg-muted/30")}>
                    <span className="font-medium">{day}</span>
                    {record && (
                      <div className={cn("w-2 h-2 rounded-full mt-0.5", CALENDAR_COLORS[record.status] ?? "bg-gray-400")} title={record.status} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(CALENDAR_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
                  <span className="text-xs text-muted-foreground capitalize">{status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm">Select an employee to view attendance calendar</div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  const today = new Date().toISOString().split("T")[0];
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState(today);
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const { data: employees } = useGetEmployees();
  const { data: records, isLoading, refetch } = useGetAttendanceRecords({
    date: dateFilter || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const createRecord = useCreateAttendanceRecord();
  const [form, setForm] = useState({ employeeId: "", date: today, status: "present", checkIn: "", checkOut: "", remarks: "" });
  
  const [reviewRecord, setReviewRecord] = useState<any | null>(null);
  const [verifyingPhotos, setVerifyingPhotos] = useState(false);

  async function handleVerifyPhotos(id: number, status: string) {
    setVerifyingPhotos(true);
    try {
      const res = await fetch(`${BASE}/attendance/${id}/verify-photos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ faceVerificationStatus: status })
      });
      if (res.ok) {
        setReviewRecord(null);
        refetch();
      } else {
        alert("Failed to verify photos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error verifying photos.");
    } finally {
      setVerifyingPhotos(false);
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createRecord.mutate({
      data: {
        ...form,
        employeeId: Number(form.employeeId),
        source: "MANUAL",
        adminName: user ? user.name : "Admin/HR",
        adminId: user?.id,
      } as any
    }, { onSuccess: () => { refetch(); setOpen(false); } });
  }

  function exportCSV() {
    if (!records?.length) return;
    const headers = [
      "Employee Name",
      "Employee Code",
      "Date",
      "Status",
      "Check In",
      "Check Out",
      "Working Hours",
      "Remarks"
    ];
    
    const rows = records.map(r => [
      r.employeeName ?? "",
      r.employeeCode ?? "",
      r.date,
      r.status,
      r.checkIn ?? "",
      r.checkOut ?? "",
      r.workingHours ?? "",
      r.remarks ?? ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">{records?.length ?? 0} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCSV} disabled={!records?.length}>
            <Download className="w-4 h-4" />Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Mark Attendance Manually</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark Attendance Manually</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
                {form.employeeId && (
                  (() => {
                    const emp = employees?.find(e => String(e.id) === form.employeeId);
                    return emp ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        Employee ID: <span className="font-semibold">{emp.employeeId}</span> | Branch: <span className="font-semibold">{emp.branchName || "Main"}</span>
                      </p>
                    ) : null;
                  })()
                )}
              </div>
              <div><Label>Date *</Label><Input className="mt-1" type="date" value={form.date} onChange={set("date")} required /></div>
              <div>
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Check In</Label><Input className="mt-1" type="time" value={form.checkIn} onChange={set("checkIn")} /></div>
                <div><Label>Check Out</Label><Input className="mt-1" type="time" value={form.checkOut} onChange={set("checkOut")} /></div>
              </div>
              <div>
                <Label>Reason for Manual Entry</Label>
                <Input className="mt-1" value={form.remarks} onChange={set("remarks")} placeholder="e.g. GPS verification failed" required />
              </div>
              <div>
                <Label>Added By (Admin/HR)</Label>
                <Input className="mt-1" value={user ? user.name : "Admin/HR"} disabled />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRecord.isPending}>Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-40" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Home Branch</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Attendance Branch</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Check In</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Check Out</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Photo Check</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(records as any[])?.map(r => (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.employeeName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1 justify-center">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700")}>
                              {r.status.replace(/_/g, " ")}
                            </span>
                            {r.source === "MANUAL" && (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.2 rounded border border-amber-200 uppercase">
                                Manual
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.homeBranchName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.attendanceBranchName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.checkIn ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.checkOut ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {r.faceVerificationStatus === "Matched" || r.faceVerificationStatus === "Verified" ? (
                            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                              ✅ Verified
                            </span>
                          ) : r.faceVerificationStatus === "Mismatched" ? (
                            <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                              ❌ Mismatched
                            </span>
                          ) : r.checkInPhoto || r.checkOutPhoto ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 px-2 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                              onClick={() => setReviewRecord(r)}
                            >
                              🔍 Review
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{r.workingHours ? `${r.workingHours}h` : "—"}</td>
                      </tr>
                    ))}
                    {!records?.length && (
                      <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        <UserCheck className="w-8 h-8 mx-auto mb-2" />
                        No attendance records found
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Dialog open={reviewRecord !== null} onOpenChange={(open) => { if (!open) setReviewRecord(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Review Attendance Photos</DialogTitle>
              </DialogHeader>
              {reviewRecord && (
                <div className="space-y-4 py-2">
                  <div className="text-sm">
                    <span className="font-semibold">Employee:</span> {reviewRecord.employeeName} ({reviewRecord.employeeCode})
                  </div>
                  <div className="text-sm flex justify-between items-center">
                    <div><span className="font-semibold">Date:</span> {reviewRecord.date}</div>
                    <div>
                      <span className="font-semibold text-xs">Status: </span>
                      <span className={`text-xs font-bold ${
                        (reviewRecord.faceVerificationStatus === "Matched" || reviewRecord.faceVerificationStatus === "Verified") ? "text-green-600" :
                        reviewRecord.faceVerificationStatus === "Mismatched" ? "text-red-600" : "text-amber-600"
                      }`}>
                        {reviewRecord.faceVerificationStatus || "Not Verified"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto">
                    {reviewRecord.checkInPhoto && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Check In Photo</div>
                        <img src={reviewRecord.checkInPhoto} className="w-full rounded-md border object-cover max-h-60" alt="Check In" />
                      </div>
                    )}
                    {reviewRecord.checkOutPhoto && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground uppercase">Check Out Photo</div>
                        <img src={reviewRecord.checkOutPhoto} className="w-full rounded-md border object-cover max-h-60" alt="Check Out" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-between pt-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => setReviewRecord(null)}>Close</Button>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-xs px-2.5"
                        onClick={() => handleVerifyPhotos(reviewRecord.id, "Not Verified")}
                        disabled={verifyingPhotos}
                      >
                        Reset Status
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="text-xs px-2.5"
                        onClick={() => handleVerifyPhotos(reviewRecord.id, "Mismatched")}
                        disabled={verifyingPhotos}
                      >
                        Mark Mismatched
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5"
                        onClick={() => handleVerifyPhotos(reviewRecord.id, "Verified")}
                        disabled={verifyingPhotos}
                      >
                        {verifyingPhotos ? "Clearing..." : "Verify & Clear"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
