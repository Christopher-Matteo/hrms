import { useState } from "react";
import { useGetAdvances, useCreateAdvance, useUpdateAdvance, useGetEmployees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CreditCard, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  recovered: "bg-gray-100 text-gray-700",
};

export default function AdvancesPage() {
  const { user } = useAuth();
  const { data: employees } = useGetEmployees();
  const { data: advances, isLoading, refetch } = useGetAdvances();
  const createAdvance = useCreateAdvance();
  const updateAdvance = useUpdateAdvance();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", amount: "", reason: "", date: new Date().toISOString().split("T")[0] });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createAdvance.mutate({
      data: { ...form, employeeId: Number(form.employeeId), amount: Number(form.amount) } as any
    }, { onSuccess: () => { refetch(); setOpen(false); setForm({ employeeId: "", amount: "", reason: "", date: new Date().toISOString().split("T")[0] }); } });
  }

  const canManage = ["super_admin", "hr_manager"].includes(user?.role ?? "");
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Salary Advances</h1>
          <p className="text-sm text-muted-foreground">{advances?.length ?? 0} advance requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Salary Advance</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div>
                <Label>Employee *</Label>
                <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount (₹) *</Label><Input className="mt-1" type="number" value={form.amount} onChange={set("amount")} required /></div>
              <div><Label>Date</Label><Input className="mt-1" type="date" value={form.date} onChange={set("date")} /></div>
              <div><Label>Reason *</Label><Input className="mt-1" value={form.reason} onChange={set("reason")} required /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createAdvance.isPending}>Submit</Button>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Remaining</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {advances?.map(a => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{a.employeeName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.date}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{Number(a.amount).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">₹{Number(a.remainingBalance).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{a.reason}</td>
                  </tr>
                ))}
                {!advances?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <CreditCard className="w-8 h-8 mx-auto mb-2" />
                    No advance requests found
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
