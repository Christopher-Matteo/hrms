import { useState } from "react";
import { useGetWeeklyOffPolicies, useCreateWeeklyOffPolicy, useDeleteWeeklyOffPolicy } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Plus, Trash2 } from "lucide-react";

const POLICY_TYPES = [
  { value: "one_day_per_week", label: "One Day Per Week" },
  { value: "two_days_per_week", label: "Two Days Per Week" },
  { value: "four_days_per_month", label: "Four Days Per Month" },
  { value: "custom", label: "Custom" },
  { value: "rotational", label: "Rotational" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyOffPage() {
  const { data: policies, isLoading, refetch } = useGetWeeklyOffPolicies();
  const createPolicy = useCreateWeeklyOffPolicy();
  const deletePolicy = useDeleteWeeklyOffPolicy();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", policyType: "one_day_per_week", offDays: [] as string[] });

  function toggleDay(day: string) {
    setForm(f => ({
      ...f,
      offDays: f.offDays.includes(day) ? f.offDays.filter(d => d !== day) : [...f.offDays, day]
    }));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createPolicy.mutate({
      data: {
        name: form.name,
        policyType: form.policyType,
        offDays: form.offDays.length > 0 ? JSON.stringify(form.offDays) : undefined,
      } as any
    }, {
      onSuccess: () => { refetch(); setOpen(false); setForm({ name: "", policyType: "one_day_per_week", offDays: [] }); }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Weekly Off Policies</h1>
          <p className="text-sm text-muted-foreground">{policies?.length ?? 0} policies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Weekly Off Policy</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div><Label>Policy Name *</Label><Input className="mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div>
                <Label>Policy Type</Label>
                <Select value={form.policyType} onValueChange={v => setForm(f => ({ ...f, policyType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{POLICY_TYPES.map(pt => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!["rotational"].includes(form.policyType) && (
                <div>
                  <Label>Off Days</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          form.offDays.includes(day) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary"
                        }`}
                        onClick={() => toggleDay(day)}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPolicy.isPending}>Create Policy</Button>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Policy Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Off Days</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies?.map(p => {
                  let offDaysDisplay = "—";
                  if (p.offDays) {
                    try { offDaysDisplay = JSON.parse(p.offDays).join(", "); } catch { offDaysDisplay = p.offDays; }
                  }
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                            <CalendarDays className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{POLICY_TYPES.find(pt => pt.value === p.policyType)?.label ?? p.policyType}</td>
                      <td className="px-4 py-3 text-muted-foreground">{offDaysDisplay}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Delete policy "${p.name}"?`)) deletePolicy.mutate({ id: p.id }, { onSuccess: () => refetch() }); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!policies?.length && (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No policies configured</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
