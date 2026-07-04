import { useState } from "react";
import { useGetContinueDuties, useCreateContinueDuty, useDeleteContinueDuty, useGetEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Briefcase } from "lucide-react";

export default function ContinueDutyPage() {
  const { data: employees } = useGetEmployees();
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const { data: duties, isLoading, refetch } = useGetContinueDuties({
    month: monthFilter || undefined,
  });
  const createDuty = useCreateContinueDuty();
  const deleteDuty = useDeleteContinueDuty();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", date: new Date().toISOString().split("T")[0], amount: "", remarks: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createDuty.mutate({
      data: { ...form, employeeId: Number(form.employeeId), amount: Number(form.amount) } as any
    }, { onSuccess: () => { refetch(); setOpen(false); setForm({ employeeId: "", date: new Date().toISOString().split("T")[0], amount: "", remarks: "" }); } });
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  const totalAmount = duties?.reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Continue Duty</h1>
          <p className="text-sm text-muted-foreground">{duties?.length ?? 0} entries · Total: ₹{totalAmount.toLocaleString("en-IN")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Continue Duty Entry</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date *</Label><Input className="mt-1" type="date" value={form.date} onChange={set("date")} required /></div>
              <div><Label>Amount (₹) *</Label><Input className="mt-1" type="number" value={form.amount} onChange={set("amount")} required /></div>
              <div><Label>Remarks</Label><Input className="mt-1" value={form.remarks} onChange={set("remarks")} /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createDuty.isPending}>Add Entry</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-40" />
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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Remarks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {duties?.map(d => (
                  <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{d.employeeName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.date}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(d.amount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.remarks ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Delete this entry?")) deleteDuty.mutate({ id: d.id }, { onSuccess: () => refetch() }); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!duties?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <Briefcase className="w-8 h-8 mx-auto mb-2" />
                    No continue duty entries for this month
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
