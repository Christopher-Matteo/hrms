import { useState } from "react";
import { Link } from "wouter";
import { useGetEmployees, useDeleteEmployee, useGetBranches } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, Eye, Trash2, Users, Download } from "lucide-react";
import { useAuth } from "@/lib/auth";

const DEPARTMENTS = ["Front Office", "Housekeeping", "Food & Beverage", "Kitchen", "Security", "Maintenance", "HR", "Finance", "IT", "Sales & Marketing"];

function statusColor(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "inactive") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const { user } = useAuth();
  const { data: employees, isLoading, refetch } = useGetEmployees({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: branches } = useGetBranches();
  const deleteEmp = useDeleteEmployee();

  const filteredEmployees = employees?.filter(emp => {
    const matchesBranch = branchFilter === "all" || String(emp.branchId) === branchFilter;
    const matchesDept = deptFilter === "all" || emp.department === deptFilter;
    return matchesBranch && matchesDept;
  });

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete employee ${name}?`)) return;
    deleteEmp.mutate({ id }, { onSuccess: () => refetch() });
  }

  function exportCSV() {
    if (!employees?.length) return;
    const headers = [
      "Employee ID",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Gender",
      "DOB",
      "Department",
      "Designation",
      "Branch",
      "Joining Date",
      "Employment Type",
      "Salary",
      "Status"
    ];
    
    const rows = employees.map(emp => [
      emp.employeeId,
      emp.firstName,
      emp.lastName,
      emp.email,
      emp.phone,
      emp.gender,
      emp.dob,
      emp.department,
      emp.designation,
      emp.branchName ?? "",
      emp.joiningDate,
      emp.employmentType,
      emp.salary,
      emp.status
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `employees_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const canManage = ["super_admin", "hr_manager"].includes(user?.role ?? "");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees?.length ?? 0} total employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCSV} disabled={!employees?.length}>
            <Download className="w-4 h-4" />Export CSV
          </Button>
          {canManage && (
            <Link href="/employees/new">
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Add Employee
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>

        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map(b => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !filteredEmployees?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No employees found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or add a new employee</p>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joining Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Salary</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-semibold text-xs">
                            {emp.firstName[0]}{emp.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                          <div className="text-xs text-muted-foreground">{emp.employeeId} · {emp.designation}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.branchName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{emp.joiningDate}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(emp.salary).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
