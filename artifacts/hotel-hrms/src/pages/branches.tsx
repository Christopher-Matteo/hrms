import { useState } from "react";
import { useGetBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Plus, Trash2, Users, Pencil } from "lucide-react";

export default function BranchesPage() {
  const { data: branches, isLoading, refetch } = useGetBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();
  const [open, setOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });

  function openCreate() {
    setEditBranchId(null);
    setForm({ name: "", address: "", phone: "", email: "" });
    setOpen(true);
  }

  function openEdit(branch: any) {
    setEditBranchId(branch.id);
    setForm({ name: branch.name, address: branch.address, phone: branch.phone, email: branch.email });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editBranchId) {
      updateBranch.mutate(
        { id: editBranchId, data: form as any },
        {
          onSuccess: () => {
            refetch();
            setOpen(false);
            setForm({ name: "", address: "", phone: "", email: "" });
            setEditBranchId(null);
          }
        }
      );
    } else {
      createBranch.mutate(
        { data: form as any },
        {
          onSuccess: () => {
            refetch();
            setOpen(false);
            setForm({ name: "", address: "", phone: "", email: "" });
          }
        }
      );
    }
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete branch "${name}"?`)) return;
    deleteBranch.mutate({ id }, { onSuccess: () => refetch() });
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Branches</h1>
          <p className="text-sm text-muted-foreground">{branches?.length ?? 0} branches</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />Add Branch
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches?.map(branch => (
            <Card key={branch.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(branch)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(branch.id, branch.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-base">{branch.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{branch.address}</p>
                <div className="mt-4 pt-4 border-t border-border flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{branch.employeeCount} employees</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">{branch.phone}</p>
                  <p className="text-xs text-muted-foreground">{branch.email}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {!branches?.length && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16">
              <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No branches yet</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBranchId ? "Edit Branch" : "Add New Branch"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div><Label>Branch Name *</Label><Input className="mt-1" value={form.name} onChange={set("name")} required /></div>
            <div><Label>Address *</Label><Input className="mt-1" value={form.address} onChange={set("address")} required /></div>
            <div><Label>Phone *</Label><Input className="mt-1" value={form.phone} onChange={set("phone")} required /></div>
            <div><Label>Email *</Label><Input className="mt-1" type="email" value={form.email} onChange={set("email")} required /></div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createBranch.isPending || updateBranch.isPending}>
                {editBranchId ? "Save Changes" : "Create Branch"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
