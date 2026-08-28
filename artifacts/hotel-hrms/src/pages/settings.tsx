import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings, useGetHolidays, useCreateHoliday, useDeleteHoliday } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { data: settings, refetch: refetchSettings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { data: holidays, refetch: refetchHolidays } = useGetHolidays({ year: new Date().getFullYear() });
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [form, setForm] = useState({
    companyName: "", companyEmail: "", companyPhone: "", companyAddress: "",
    overtimeRatePerHour: "", continueDutyRate: "", lateDeductionPerMinute: "",
    gracePeriodMinutes: "", workingHoursPerDay: "",
  });
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: "", date: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName ?? "",
        companyEmail: settings.companyEmail ?? "",
        companyPhone: settings.companyPhone ?? "",
        companyAddress: settings.companyAddress ?? "",
        overtimeRatePerHour: String(settings.overtimeRatePerHour ?? ""),
        continueDutyRate: String(settings.continueDutyRate ?? ""),
        lateDeductionPerMinute: String(settings.lateDeductionPerMinute ?? ""),
        gracePeriodMinutes: String(settings.gracePeriodMinutes ?? ""),
        workingHoursPerDay: String(settings.workingHoursPerDay ?? ""),
      });
    }
  }, [settings]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateSettings.mutate({
      data: {
        ...form,
        gracePeriodMinutes: Number(form.gracePeriodMinutes),
      } as any
    }, {
      onSuccess: () => { refetchSettings(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    });
  }

  function handleCreateHoliday(e: React.FormEvent) {
    e.preventDefault();
    createHoliday.mutate({ data: holidayForm as any }, {
      onSuccess: () => { refetchHolidays(); setHolidayOpen(false); setHolidayForm({ name: "", date: "" }); }
    });
  }

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure company and payroll settings</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Config</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader><CardTitle className="text-sm">Company Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div><Label>Company Name</Label><Input className="mt-1" value={form.companyName} onChange={set("companyName")} /></div>
                <div><Label>Email</Label><Input className="mt-1" type="email" value={form.companyEmail} onChange={set("companyEmail")} /></div>
                <div><Label>Phone</Label><Input className="mt-1" value={form.companyPhone} onChange={set("companyPhone")} /></div>
                <div className="col-span-2"><Label>Address</Label><Input className="mt-1" value={form.companyAddress} onChange={set("companyAddress")} /></div>
              </CardContent>
            </Card>
            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" size="sm" className="gap-2" disabled={updateSettings.isPending}>
                <Save className="w-3.5 h-3.5" />{updateSettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
              {saved && <span className="text-sm text-green-600">Saved successfully</span>}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader><CardTitle className="text-sm">Payroll Configuration</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Overtime Rate (₹/hour)</Label>
                  <Input className="mt-1" type="number" value={form.overtimeRatePerHour} onChange={set("overtimeRatePerHour")} />
                </div>
                <div>
                  <Label>Late Deduction (₹/minute)</Label>
                  <Input className="mt-1" type="number" value={form.lateDeductionPerMinute} onChange={set("lateDeductionPerMinute")} />
                </div>
                <div>
                  <Label>Grace Period (minutes)</Label>
                  <Input className="mt-1" type="number" value={form.gracePeriodMinutes} onChange={set("gracePeriodMinutes")} />
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" size="sm" className="gap-2" disabled={updateSettings.isPending}>
                <Save className="w-3.5 h-3.5" />{updateSettings.isPending ? "Saving..." : "Save Changes"}
              </Button>
              {saved && <span className="text-sm text-green-600">Saved successfully</span>}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="holidays" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{holidays?.length ?? 0} holidays in {new Date().getFullYear()}</p>
              <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />Add Holiday</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Holiday</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateHoliday} className="space-y-4 mt-2">
                    <div><Label>Holiday Name *</Label><Input className="mt-1" value={holidayForm.name} onChange={e => setHolidayForm(f => ({ ...f, name: e.target.value }))} required /></div>
                    <div><Label>Date *</Label><Input className="mt-1" type="date" value={holidayForm.date} onChange={e => setHolidayForm(f => ({ ...f, date: e.target.value }))} required /></div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setHolidayOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createHoliday.isPending}>Add Holiday</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Holiday</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays?.map(h => (
                      <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium">{h.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{h.date}</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Delete holiday "${h.name}"?`)) deleteHoliday.mutate({ id: h.id }, { onSuccess: () => refetchHolidays() }); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!holidays?.length && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">No holidays added</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
