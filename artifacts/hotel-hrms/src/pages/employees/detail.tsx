import { useRoute, Link } from "wouter";
import { useGetEmployee, useUpdateEmployee } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save } from "lucide-react";

export default function EmployeeDetailPage() {
  const [, params] = useRoute("/employees/:id");
  const id = Number(params?.id);
  const { data: employee, isLoading, refetch } = useGetEmployee(id);
  const updateEmployee = useUpdateEmployee();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

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

  const Field = ({ label, value, field, type = "text" }: { label: string; value?: string | number | null; field?: string; type?: string }) => (
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
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="First Name" value={employee.firstName} field="firstName" />
                <Field label="Last Name" value={employee.lastName} field="lastName" />
                <Field label="Email" value={employee.email} field="email" type="email" />
                <Field label="Phone" value={employee.phone} field="phone" />
                <Field label="Gender" value={employee.gender} />
                <Field label="Date of Birth" value={employee.dob} />
                <div className="col-span-2">
                  <Field label="Address" value={employee.address} field="address" />
                </div>
                <Field label="Emergency Contact" value={employee.emergencyContact} />
                <Field label="PAN Number" value={employee.panNumber} />
                <Field label="Aadhaar Number" value={employee.aadhaarNumber} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Employment Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Employee ID" value={employee.employeeId} />
                <Field label="Department" value={employee.department} />
                <Field label="Designation" value={employee.designation} field="designation" />
                <Field label="Branch" value={employee.branchName} />
                <Field label="Shift" value={employee.shiftName} />
                <Field label="Weekly Off Policy" value={employee.weeklyOffPolicyName} />
                <Field label="Joining Date" value={employee.joiningDate} />
                <Field label="Employment Type" value={employee.employmentType} />
                <Field label="Salary (₹/month)" value={Number(employee.salary).toLocaleString("en-IN")} field="salary" type="number" />
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
                  <Field label="Status" value={employee.status} />
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
                <Field label="Bank Name" value={employee.bankName} field="bankName" />
                <Field label="Account Number" value={employee.accountNumber} field="accountNumber" />
                <Field label="IFSC Code" value={employee.ifscCode} field="ifscCode" />
                <Field label="UPI ID" value={employee.upiId} field="upiId" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
