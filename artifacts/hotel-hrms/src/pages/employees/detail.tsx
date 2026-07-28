import { useRoute, Link } from "wouter";
import { useGetEmployee, useUpdateEmployee, useGetBranches, useGetShifts, useGetWeeklyOffPolicies } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";

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
  const updateEmployee = useUpdateEmployee();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

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

  const handleSetPassword = async () => {
    if (!manualPassword || manualPassword.length < 6) return;
    setPasswordLoading(true);
    setPasswordMessage(null);
    try {
      const res = await fetch(`/api/employees/${id}/password`, {
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
      const res = await fetch(`/api/employees/verify-email/request`, {
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
      const res = await fetch(`/api/employees/verify-email/confirm`, {
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
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
      designation: employee.designation,
      salary: employee.salary,
      address: employee.address,
      bankName: employee.bankName,
      accountNumber: employee.accountNumber,
      ifscCode: employee.ifscCode,
      upiId: employee.upiId,
      gender: employee.gender,
      dob: employee.dob,
      emergencyContact: employee.emergencyContact,
      panNumber: employee.panNumber,
      aadhaarNumber: employee.aadhaarNumber,
      employeeId: employee.employeeId,
      department: employee.department,
      branchId: employee.branchId,
      shiftId: employee.shiftId,
      weeklyOffPolicyId: employee.weeklyOffPolicyId,
      joiningDate: employee.joiningDate,
      employmentType: employee.employmentType,
    });
    setEditing(true);
  }

  function handleSave() {
    updateEmployee.mutate(
      { id, data: form as any },
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
          <p className="text-sm text-muted-foreground">{employee.employeeId} · {employee.designation}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={employee.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
            {employee.status}
          </Badge>
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

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="bank">Bank Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderField("First Name", employee.firstName, "firstName")}
                {renderField("Last Name", employee.lastName, "lastName")}
                
                {renderField("Email", employee.email, "email", "email")}

                {renderField("Phone", employee.phone, "phone")}
                {editing ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Gender</Label>
                    <Select value={String(form.gender ?? "male")} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  renderField("Gender", employee.gender)
                )}
                {renderField("Date of Birth", employee.dob, "dob", "date")}
                <div className="col-span-2">
                  {renderField("Address", employee.address, "address")}
                </div>
                {renderField("Emergency Contact", employee.emergencyContact, "emergencyContact")}
                {renderField("PAN Number", employee.panNumber, "panNumber")}
                {renderField("Aadhaar Number", employee.aadhaarNumber, "aadhaarNumber")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Employment Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderField("Employee ID", employee.employeeId, "employeeId")}
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
                {renderField("Designation", employee.designation, "designation")}
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
                    <Label className="text-xs text-muted-foreground">Shift</Label>
                    <Select value={String(form.shiftId ?? "")} onValueChange={(v) => setForm(f => ({ ...f, shiftId: v ? Number(v) : null }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select shift" /></SelectTrigger>
                      <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  renderField("Shift", employee.shiftName)
                )}
                {editing ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Weekly Off Policy</Label>
                    <Select value={String(form.weeklyOffPolicyId ?? "")} onValueChange={(v) => setForm(f => ({ ...f, weeklyOffPolicyId: v ? Number(v) : null }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select policy" /></SelectTrigger>
                      <SelectContent>{policies?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ) : (
                  renderField("Weekly Off Policy", employee.weeklyOffPolicyName)
                )}
                {renderField("Joining Date", employee.joiningDate, "joiningDate", "date")}
                {editing ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Employment Type</Label>
                    <Select value={String(form.employmentType ?? "")} onValueChange={(v) => setForm(f => ({ ...f, employmentType: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="intern">Intern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  renderField("Employment Type", employee.employmentType)
                )}
                {renderField("Salary (₹/month)", Number(employee.salary).toLocaleString("en-IN"), "salary", "number")}
                {editing ? (
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={String(form.status)} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  renderField("Status", employee.status)
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderField("Bank Name", employee.bankName, "bankName")}
                {renderField("Account Number", employee.accountNumber, "accountNumber")}
                {renderField("IFSC Code", employee.ifscCode, "ifscCode")}
                {renderField("UPI ID", employee.upiId, "upiId")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
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
                disabled={!manualPassword || manualPassword.length < 6 || passwordLoading}
              >
                {passwordLoading ? "Setting..." : "Set Password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
