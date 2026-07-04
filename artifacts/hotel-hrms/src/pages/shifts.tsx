import { useState } from "react";
import { useGetShifts, useCreateShift, useDeleteShift } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, Plus, Trash2 } from "lucide-react";

export default function ShiftsPage() {
  const { data: shifts, isLoading, refetch } = useGetShifts();
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", startTime: "", endTime: "", gracePeriodMinutes: "15" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createShift.mutate({
      data: { ...form, gracePeriodMinutes: Number(form.gracePeriodMinutes) } as any
    }, {
      onSuccess: () => { refetch(); setOpen(false); setForm({ name: "", startTime: "", endTime: "", gracePeriodMinutes: "15" }); }
    });
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Shifts</h1>
          <p className="text-sm text-muted-foreground">{shifts?.length ?? 0} shifts configured</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Shift</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Shift</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div><Label>Shift Name *</Label><Input className="mt-1" value={form.name} onChange={set("name")} placeholder="Morning Shift" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Time *</Label><Input className="mt-1" type="time" value={form.startTime} onChange={set("startTime")} required /></div>
                <div><Label>End Time *</Label><Input className="mt-1" type="time" value={form.endTime} onChange={set("endTime")} required /></div>
              </div>
              <div><Label>Grace Period (minutes)</Label><Input className="mt-1" type="number" value={form.gracePeriodMinutes} onChange={set("gracePeriodMinutes")} /></div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createShift.isPending}>Create Shift</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts?.map(shift => (
            <Card key={shift.id}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete shift "${shift.name}"?`)) deleteShift.mutate({ id: shift.id }, { onSuccess: () => refetch() }); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <h3 className="font-semibold">{shift.name}</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Start</span>
                    <span className="font-medium">{shift.startTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">End</span>
                    <span className="font-medium">{shift.endTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Grace Period</span>
                    <span className="font-medium">{shift.gracePeriodMinutes} min</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {!shifts?.length && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm font-medium">No shifts configured</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
