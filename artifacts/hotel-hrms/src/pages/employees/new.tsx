import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateEmployee, useGetBranches, useGetShifts, useGetWeeklyOffPolicies } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const DEPARTMENTS = ["Front Office", "Housekeeping", "Food & Beverage", "Kitchen", "Security", "Maintenance", "HR", "Finance", "IT", "Sales & Marketing"];

export default function NewEmployeePage() {
  const [, setLocation] = useLocation();
  const { data: branches } = useGetBranches();
  const { data: shifts } = useGetShifts();
  const { data: policies } = useGetWeeklyOffPolicies();
  const createEmployee = useCreateEmployee();

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", gender: "male",
    dob: "", address: "", emergencyContact: "", department: "", designation: "",
    branchId: "", shiftId: "", weeklyOffPolicyId: "", joiningDate: "",
    employmentType: "full_time", salary: "", bankName: "", accountNumber: "",
    ifscCode: "", upiId: "", panNumber: "", aadhaarNumber: "",
  });

  const [error, setError] = useState("");

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    createEmployee.mutate(
      {
        data: {
          ...form,
          branchId: Number(form.branchId),
          shiftId: form.shiftId ? Number(form.shiftId) : undefined,
          weeklyOffPolicyId: form.weeklyOffPolicyId ? Number(form.weeklyOffPolicyId) : undefined,
          salary: Number(form.salary),
        } as any,
      },
      {
        onSuccess: (emp) => setLocation(`/employees/${emp.id}`),
        onError: () => setError("Failed to create employee. Please check all fields."),
      }
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">New Employee</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to add a new employee</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>First Name *</Label><Input className="mt-1" value={form.firstName} onChange={set("firstName")} required /></div>
            <div><Label>Last Name *</Label><Input className="mt-1" value={form.lastName} onChange={set("lastName")} required /></div>
            <div><Label>Email *</Label><Input className="mt-1" type="email" value={form.email} onChange={set("email")} required /></div>
            <div><Label>Phone *</Label><Input className="mt-1" value={form.phone} onChange={set("phone")} required /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date of Birth</Label><Input className="mt-1" type="date" value={form.dob} onChange={set("dob")} /></div>
            <div className="col-span-2"><Label>Address</Label><Input className="mt-1" value={form.address} onChange={set("address")} /></div>
            <div><Label>Emergency Contact</Label><Input className="mt-1" value={form.emergencyContact} onChange={set("emergencyContact")} /></div>
            <div><Label>PAN Number</Label><Input className="mt-1" value={form.panNumber} onChange={set("panNumber")} /></div>
            <div><Label>Aadhaar Number</Label><Input className="mt-1" value={form.aadhaarNumber} onChange={set("aadhaarNumber")} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Employment Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Department *</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Designation *</Label><Input className="mt-1" value={form.designation} onChange={set("designation")} required /></div>
            <div>
              <Label>Branch *</Label>
              <Select value={form.branchId} onValueChange={v => setForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>{branches?.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shift</Label>
              <Select value={form.shiftId} onValueChange={v => setForm(f => ({ ...f, shiftId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Weekly Off Policy</Label>
              <Select value={form.weeklyOffPolicyId} onValueChange={v => setForm(f => ({ ...f, weeklyOffPolicyId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select policy" /></SelectTrigger>
                <SelectContent>{policies?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Joining Date *</Label><Input className="mt-1" type="date" value={form.joiningDate} onChange={set("joiningDate")} required /></div>
            <div>
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={v => setForm(f => ({ ...f, employmentType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Monthly Salary (₹) *</Label><Input className="mt-1" type="number" value={form.salary} onChange={set("salary")} required /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Bank Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><Label>Bank Name</Label><Input className="mt-1" value={form.bankName} onChange={set("bankName")} /></div>
            <div><Label>Account Number</Label><Input className="mt-1" value={form.accountNumber} onChange={set("accountNumber")} /></div>
            <div><Label>IFSC Code</Label><Input className="mt-1" value={form.ifscCode} onChange={set("ifscCode")} /></div>
            <div><Label>UPI ID</Label><Input className="mt-1" value={form.upiId} onChange={set("upiId")} /></div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>}

        <div className="flex gap-3">
          <Link href="/employees"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending ? "Creating..." : "Create Employee"}
          </Button>
        </div>
      </form>
    </div>
  );
}
