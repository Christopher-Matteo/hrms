import { useState } from "react";
import { useGetDepartments, useCreateDepartment, useDeleteDepartment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Layers, Plus, Trash2, Users } from "lucide-react";

export default function DepartmentsPage() {
  const { data: departments, isLoading, refetch } = useGetDepartments();
  const createDept = useCreateDepartment();
  const deleteDept = useDeleteDepartment();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createDept.mutate({ data: { name } as any }, {
      onSuccess: () => { refetch(); setOpen(false); setName(""); }
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete department "${name}"?`)) return;
    deleteDept.mutate({ id }, { onSuccess: () => refetch() });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">{departments?.length ?? 0} departments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Department</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div><Label>Department Name *</Label><Input className="mt-1" value={name} onChange={e => setName(e.target.value)} required /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createDept.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employees</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments?.map(dept => (
                  <tr key={dept.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Layers className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>{dept.employeeCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(dept.id, dept.name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!departments?.length && (
                  <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">No departments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
