import { useState } from "react";
import { useGetAttendanceRecords, useCreateAttendanceRecord, useGetEmployees, useGetAttendanceCalendar } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Filter, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
    { employeeId: selectedEmployee ? Number(selectedEmployee) : undefined, month: month || undefined }
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

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createRecord.mutate({
      data: { ...form, employeeId: Number(form.employeeId) } as any
    }, { onSuccess: () => { refetch(); setOpen(false); } });
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">{records?.length ?? 0} records</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Mark Attendance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
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
              <div><Label>Remarks</Label><Input className="mt-1" value={form.remarks} onChange={set("remarks")} /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createRecord.isPending}>Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Check In</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Check Out</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records?.map(r => (
                      <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.employeeName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700")}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.checkIn ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.checkOut ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{r.workingHours ? `${r.workingHours}h` : "—"}</td>
                      </tr>
                    ))}
                    {!records?.length && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        <UserCheck className="w-8 h-8 mx-auto mb-2" />
                        No attendance records found
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
