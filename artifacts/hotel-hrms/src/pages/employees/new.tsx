import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateEmployee, useGetBranches, useGetShifts, useGetWeeklyOffPolicies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check } from "lucide-react";

const DEPARTMENTS = ["Front Office", "Housekeeping", "Food & Beverage", "Kitchen", "Security", "Maintenance", "HR", "Finance", "IT", "Sales & Marketing"];

export default function NewEmployeePage() {
  const [, setLocation] = useLocation();
  const { data: branches } = useGetBranches();
  const { data: shifts } = useGetShifts();
  const { data: policies } = useGetWeeklyOffPolicies();
  const createEmployee = useCreateEmployee();

  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    phone: "",
    dob: "",
    branchId: "",
    department: "",
    shiftId: "",
    salary: "",
    weeklyOffPolicyId: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{
    id: number;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    generatedPassword?: string;
  } | null>(null);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    createEmployee.mutate(
      {
        data: {
          employeeId: form.employeeId ? form.employeeId.trim() : undefined,
          name: form.name.trim(),
          phone: form.phone.trim(),
          dob: form.dob || undefined,
          branchId: Number(form.branchId),
          department: form.department,
          shiftId: form.shiftId ? Number(form.shiftId) : undefined,
          weeklyOffPolicyId: form.weeklyOffPolicyId ? Number(form.weeklyOffPolicyId) : undefined,
          salary: Number(form.salary),
          password: form.password ? form.password.trim() : undefined,
        } as any,
      },
      {
        onSuccess: (emp: any) => {
          setSuccessData(emp);
        },
        onError: (err: any) => setError(err?.data?.error || err?.message || "Failed to create employee. Please check all fields."),
      }
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">New Employee</h1>
          <p className="text-sm text-muted-foreground">Fill in the essential details to register a new employee</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Required Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="emp-name">Employee Name *</Label>
              <Input id="emp-name" className="mt-1" placeholder="e.g. Abhinesh M" value={form.name} onChange={set("name")} required />
            </div>

            <div>
              <Label htmlFor="emp-phone">Mobile Number *</Label>
              <Input id="emp-phone" className="mt-1" placeholder="e.g. 8270682113" value={form.phone} onChange={set("phone")} required />
            </div>

            <div>
              <Label htmlFor="emp-salary">Monthly Salary (₹) *</Label>
              <Input id="emp-salary" className="mt-1" type="number" placeholder="e.g. 15000" value={form.salary} onChange={set("salary")} required />
            </div>

            <div>
              <Label htmlFor="emp-branch">Branch *</Label>
              <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger id="emp-branch" className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emp-dept">Department *</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger id="emp-dept" className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Optional Details & Credentials</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emp-id">Employee ID</Label>
              <Input id="emp-id" className="mt-1" placeholder="Leave blank to auto-generate" value={form.employeeId} onChange={set("employeeId")} />
            </div>

            <div>
              <Label htmlFor="emp-dob">Date of Birth</Label>
              <Input id="emp-dob" className="mt-1" type="date" value={form.dob} onChange={set("dob")} />
            </div>

            <div>
              <Label htmlFor="emp-shift">Shift Time</Label>
              <Select value={form.shiftId} onValueChange={v => setForm(f => ({ ...f, shiftId: v }))}>
                <SelectTrigger id="emp-shift" className="mt-1"><SelectValue placeholder="Select shift time" /></SelectTrigger>
                <SelectContent>
                  {shifts?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="emp-weekoff">Weekoff Policy</Label>
              <Select value={form.weeklyOffPolicyId} onValueChange={v => setForm(f => ({ ...f, weeklyOffPolicyId: v }))}>
                <SelectTrigger id="emp-weekoff" className="mt-1"><SelectValue placeholder="Select weekoff policy" /></SelectTrigger>
                <SelectContent>
                  {policies?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="emp-password">Portal Password</Label>
              <Input id="emp-password" className="mt-1" type="text" placeholder="Leave blank to auto-generate (e.g. ABHI2001)" value={form.password} onChange={set("password")} />
              <p className="text-[10px] text-muted-foreground mt-1">If empty, defaults to uppercase first 4 letters of name + year of birth.</p>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">{error}</p>}

        <div className="flex gap-3">
          <Link href="/employees"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending ? "Creating..." : "Create Employee"}
          </Button>
        </div>
      </form>

      {successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-background border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-2">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Employee Created Successfully</h3>
              <p className="text-sm text-muted-foreground">
                The employee profile and login account have been configured.
              </p>
            </div>

            <div className="border rounded-xl p-4 bg-zinc-50 dark:bg-zinc-950 space-y-3 text-sm">
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-semibold">{successData.employeeId}</span>
              </div>
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-semibold">{successData.firstName} {successData.lastName}</span>
              </div>
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-muted-foreground">Username / Email</span>
                <span className="font-mono font-medium">{successData.email}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Portal Password</span>
                <span className="font-mono font-semibold text-primary">{successData.generatedPassword}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Please note or copy the portal credentials before closing.
            </p>

            <Button onClick={() => setLocation(`/employees/${successData.id}`)} className="w-full">
              Go to Employee Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
