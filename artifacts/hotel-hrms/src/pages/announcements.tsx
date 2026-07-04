import { useState } from "react";
import { useGetAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { data: announcements, isLoading, refetch } = useGetAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", targetRole: "all" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createAnnouncement.mutate({
      data: {
        title: form.title,
        content: form.content,
        targetRole: form.targetRole !== "all" ? form.targetRole : undefined,
      } as any
    }, { onSuccess: () => { refetch(); setOpen(false); setForm({ title: "", content: "", targetRole: "all" }); } });
  }

  const canManage = ["super_admin", "hr_manager"].includes(user?.role ?? "");
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(prev => ({ ...prev, [f]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground">{announcements?.length ?? 0} announcements</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Announcement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div><Label>Title *</Label><Input className="mt-1" value={form.title} onChange={set("title")} required /></div>
                <div>
                  <Label>Content *</Label>
                  <textarea
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-24 resize-y"
                    value={form.content}
                    onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Target Audience</Label>
                  <Select value={form.targetRole} onValueChange={v => setForm(f => ({ ...f, targetRole: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="hr_manager">HR Managers</SelectItem>
                      <SelectItem value="branch_manager">Branch Managers</SelectItem>
                      <SelectItem value="employee">Employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createAnnouncement.isPending}>Publish</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : !announcements?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-base">{a.title}</h3>
                      {a.targetRole && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {a.targetRole.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{a.createdByName ?? "HR Team"}</span>
                      <span>·</span>
                      <span>{new Date(a.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => { if (confirm("Delete this announcement?")) deleteAnnouncement.mutate({ id: a.id }, { onSuccess: () => refetch() }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
