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
  { value: "one_week_per_month", label: "One Week Per Month (1st week only)" },
  { value: "four_weeks_per_month", label: "Four Weeks Per Month (first 4 weeks only)" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WeeklyOffPage() {
  const { data: policies, isLoading, refetch } = useGetWeeklyOffPolicies();
  const createPolicy = useCreateWeeklyOffPolicy();
  const deletePolicy = useDeleteWeeklyOffPolicy();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    frequency: "monthly",
    daysCount: "4",
    daySelect: "Sunday",
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    
    // Auto-generate name based on frequency and daysCount
    const namePrefix = form.frequency === "monthly" ? "month" : "week";
    const policyName = `${namePrefix}-${form.daysCount}`;

    // Determine policyType
    let policyType = "custom";
    const count = parseInt(form.daysCount, 10);
    if (form.frequency === "monthly") {
      if (count === 1) policyType = "one_week_per_month";
      else if (count === 2) policyType = "two_weeks_per_month";
      else if (count === 3) policyType = "three_weeks_per_month";
      else if (count === 4) policyType = "four_days_per_month";
    } else if (form.frequency === "weekly") {
      if (count === 1) policyType = "one_day_per_week";
      else if (count === 2) policyType = "two_days_per_week";
    }

    createPolicy.mutate({
      data: {
        name: policyName,
        policyType: policyType,
        offDays: JSON.stringify([form.daySelect]),
      } as any
    }, {
      onSuccess: () => {
        refetch();
        setOpen(false);
        setForm({ frequency: "monthly", daysCount: "4", daySelect: "Sunday" });
      }
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
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Number of Days</Label>
                <Select value={form.daysCount} onValueChange={v => setForm(f => ({ ...f, daysCount: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="2">2 Days</SelectItem>
                    <SelectItem value="3">3 Days</SelectItem>
                    <SelectItem value="4">4 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Weekly Off Day</Label>
                <Select value={form.daySelect} onValueChange={v => setForm(f => ({ ...f, daySelect: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anyday">Any Day (Flexible/Rotational)</SelectItem>
                    <SelectItem value="Sunday">Sunday</SelectItem>
                    <SelectItem value="Monday">Monday</SelectItem>
                    <SelectItem value="Tuesday">Tuesday</SelectItem>
                    <SelectItem value="Wednesday">Wednesday</SelectItem>
                    <SelectItem value="Thursday">Thursday</SelectItem>
                    <SelectItem value="Friday">Friday</SelectItem>
                    <SelectItem value="Saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {p.name?.startsWith("month-") ? `Monthly (${p.name.split("-")[1]} Days)` : p.name?.startsWith("week-") ? `Weekly (${p.name.split("-")[1]} Days)` : p.policyType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {offDaysDisplay === "anyday" ? "Any Day (Flexible)" : offDaysDisplay}
                      </td>
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
