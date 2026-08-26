import { useRoute, Link } from "wouter";
import { useGetEmployee, useUpdateEmployee, useGetBranches, useGetShifts, useGetWeeklyOffPolicies, useGetShiftSchedules, useAssignShiftSchedule } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Save, Plus } from "lucide-react";

const BASE = (import.meta as any).env.VITE_API_URL && !(import.meta as any).env.VITE_API_URL.includes("railway.app") ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

const DEPARTMENTS = [
  "Front Office",
  "Housekeeping",
  "Food & Beverage",
  "Kitchen",
  "Security",
  "Maintenance",
  "HR",
  "Finance",
  "IT",
  "Sales & Marketing",
];

export default function EmployeeDetailPage() {
  const [, params] = useRoute("/employees/:id");
  const id = Number(params?.id);
  const { data: employee, isLoading, refetch } = useGetEmployee(id);
  const { data: branches } = useGetBranches();
  const { data: shifts } = useGetShifts();
  const { data: policies } = useGetWeeklyOffPolicies();
  const { data: schedules, refetch: refetchSchedules } = useGetShiftSchedules({ employeeId: id });
  const assignSchedule = useAssignShiftSchedule();
  const updateEmployee = useUpdateEmployee();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  // Shift schedule assignment state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: "", shiftId: "" });
  const [scheduleError, setScheduleError] = useState("");

  // Email verification dialog states
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationStep, setVerificationStep] = useState<1 | 2>(1);
  const [otpInput, setOtpInput] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Manual password set states
  const [manualPassword, setManualPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleAssignSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.date || !scheduleForm.shiftId) {
      setScheduleError("Both date and shift are required");
      return;
    }
    setScheduleError("");
    assignSchedule.mutate({
      data: {
        employeeId: id,
        shiftId: Number(scheduleForm.shiftId),
        date: scheduleForm.date
      }
    }, {
      onSuccess: () => {
        refetchSchedules();
        setScheduleOpen(false);
        setScheduleForm({ date: "", shiftId: "" });
      },
      onError: (err: any) => {
        setScheduleError(err?.message || "Failed to assign shift schedule");
      }
    });
  }

  const handleSetPassword = async () => {
    if (!manualPassword || manualPassword.length < 4) return;
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const res = await fetch(`${BASE}/employees/${id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: manualPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage({ type: "error", text: data.error ?? "Failed to set password." });
      } else {
        setPasswordMessage({ type: "success", text: "Password updated successfully!" });
        setManualPassword("");
      }
    } catch {
      setPasswordMessage({ type: "error", text: "Network error setting password." });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!employee?.email) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await fetch(`${BASE}/employees/verify-email/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employee.email }),
      });
      if (!res.ok) {
        const d = await res.json();
        setVerifyError(d.error ?? "Failed to send OTP code.");
      } else {
        setVerificationStep(2);
      }
    } catch {
      setVerifyError("Network error.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput || !employee?.email) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await fetch(`${BASE}/employees/verify-email/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: employee.email, otp: otpInput }),
      });
      if (!res.ok) {
        const d = await res.json();
        setVerifyError(d.error ?? "Invalid OTP code.");
      } else {
        setVerificationOpen(false);
        setVerificationStep(1);
        setOtpInput("");
        refetch();
      }
    } catch {
      setVerifyError("Network error.");
    } finally {
      setVerifyLoading(false);
    }
  };

  function startEdit() {
    if (!employee) return;
    setForm({
      employeeId: employee.employeeId,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      phone: employee.phone,
      branchId: employee.branchId,
      department: employee.department,
      shiftId: employee.shiftId,
      salary: employee.salary,
      weeklyOffPolicyId: employee.weeklyOffPolicyId,
    });
    setEditing(true);
  }

  function handleSave() {
    const nameParts = (String(form.name || "")).trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const submitData = {
      employeeId: form.employeeId,
      firstName,
      lastName,
      phone: form.phone,
      branchId: form.branchId ? Number(form.branchId) : null,
      department: form.department,
      shiftId: form.shiftId ? Number(form.shiftId) : null,
      salary: Number(form.salary),
      weeklyOffPolicyId: form.weeklyOffPolicyId ? Number(form.weeklyOffPolicyId) : null,
    };

    updateEmployee.mutate(
      { id, data: submitData as any },
      { onSuccess: () => { refetch(); setEditing(false); } }
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!employee) return <div className="text-center py-12 text-muted-foreground">Employee not found</div>;

  const renderField = (label: string, value?: string | number | null, field?: string, type = "text") => (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing && field ? (
        <Input
          type={type}
          value={String(form[field] ?? "")}
          onChange={(e) => setForm(f => ({ ...f, [field]: e.target.value }))}
          className="mt-1"
        />
      ) : (
        <p className="text-sm font-medium mt-1">{value ?? "—"}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{employee.firstName} {employee.lastName}</h1>
          <p className="text-sm text-zinc-500">{employee.employeeId}</p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={updateEmployee.isPending} className="gap-2">
                <Save className="w-3.5 h-3.5" />Save
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={startEdit}>Edit</Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Employee Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {renderField("Employee ID", employee.employeeId, "employeeId")}
              
              {editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Employee Name</Label>
                  <Input
                    value={String(form.name ?? "")}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs text-zinc-500">Employee Name</Label>
                  <p className="text-sm font-medium mt-1">{employee.firstName} {employee.lastName}</p>
                </div>
              )}

              {renderField("Mobile Number", employee.phone, "phone")}

              {editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Branch</Label>
                  <Select value={String(form.branchId ?? "")} onValueChange={(v) => setForm(f => ({ ...f, branchId: v ? Number(v) : null }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                renderField("Branch", employee.branchName)
              )}

              {editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <Select value={String(form.department ?? "")} onValueChange={(v) => setForm(f => ({ ...f, department: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                renderField("Department", employee.department)
              )}

              {editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Shift Time</Label>
                  <Select value={String(form.shiftId ?? "")} onValueChange={(v) => setForm(f => ({ ...f, shiftId: v ? Number(v) : null }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select shift" /></SelectTrigger>
                    <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                renderField("Shift Time", employee.shiftName)
              )}

              {renderField("Monthly Salary (₹)", Number(employee.salary).toLocaleString("en-IN"), "salary", "number")}

              {editing ? (
                <div>
                  <Label className="text-xs text-muted-foreground">Weekoff Policy</Label>
                  <Select value={String(form.weeklyOffPolicyId ?? "")} onValueChange={(v) => setForm(f => ({ ...f, weeklyOffPolicyId: v ? Number(v) : null }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select policy" /></SelectTrigger>
                    <SelectContent>{policies?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                renderField("Weekoff Policy", employee.weeklyOffPolicyName)
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Password Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-sm">
            <p className="text-xs text-muted-foreground">
              Set a manual password for this employee to allow them to log in to the Employee Portal.
            </p>
            <div className="space-y-2">
              <Label htmlFor="manualPassword">New Password</Label>
              <Input
                id="manualPassword"
                type="text"
                placeholder="e.g. CHRI2005"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
              />
            </div>
            {passwordMessage && (
              <p className={`text-xs ${passwordMessage.type === "success" ? "text-green-600" : "text-destructive"}`}>
                {passwordMessage.text}
              </p>
            )}
            <Button 
              onClick={handleSetPassword} 
              disabled={!manualPassword || manualPassword.length < 4 || passwordLoading}
            >
              {passwordLoading ? "Setting..." : "Set Password"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold">Shift Schedule Changes</CardTitle>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1">
                  <Plus className="w-3.5 h-3.5" /> Assign Shift
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Custom Shift</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAssignSchedule} className="space-y-4 mt-2">
                  <div>
                    <Label>Select Date *</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={scheduleForm.date}
                      onChange={(e) => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Select Shift *</Label>
                    <Select
                      value={scheduleForm.shiftId}
                      onValueChange={(v) => setScheduleForm(prev => ({ ...prev, shiftId: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Choose shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts?.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={assignSchedule.isPending}>
                      {assignSchedule.isPending ? "Assigning..." : "Assign Shift"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              View and schedule custom shift timings for specific dates to ensure correct attendance records.
            </p>
            {schedules && schedules.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b bg-muted/50 font-semibold">
                      <th className="p-2">Date</th>
                      <th className="p-2">Shift Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(sched => (
                      <tr key={sched.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2 font-mono font-medium">{sched.date}</td>
                        <td className="p-2">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {sched.shiftName}
                          </span>{" "}
                          <span className="text-[10px] text-zinc-500">
                            ({sched.startTime} - {sched.endTime})
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 border border-dashed rounded-lg">
                No custom shift timings scheduled. Standard shift applies.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {verificationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-background border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-semibold text-sm">Verify Email Address</h3>
              <button 
                onClick={() => { setVerificationOpen(false); setVerificationStep(1); setOtpInput(""); setVerifyError(""); }} 
                className="text-muted-foreground hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Verify registered email address: <strong>{employee.email}</strong>
            </p>

            {verificationStep === 1 ? (
              <div className="space-y-3 pt-2">
                <Button onClick={handleSendOtp} disabled={verifyLoading} className="w-full">
                  {verifyLoading ? "Sending..." : "Send Verification OTP"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="text-[10px] text-zinc-500">Check server console logs for the mocked 6-digit OTP code.</p>
                <div className="space-y-1">
                  <Label className="text-xs">Enter 6-Digit OTP</Label>
                  <Input 
                    type="text" 
                    value={otpInput} 
                    onChange={(e) => setOtpInput(e.target.value)} 
                    placeholder="123456" 
                    className="text-center font-mono font-bold tracking-widest text-base"
                  />
                </div>
                <Button onClick={handleVerifyOtp} disabled={verifyLoading || !otpInput} className="w-full">
                  {verifyLoading ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            )}

            {verifyError && (
              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">{verifyError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
