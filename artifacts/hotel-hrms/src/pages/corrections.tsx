import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Clock, CheckCircle2, XCircle, Search, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = (import.meta as any).env.VITE_API_URL ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30",
  approved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
  rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
};

interface AttendanceCorrection {
  id: number;
  employeeId: number;
  attendanceId: number | null;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: string;
  createdAt: string;
  employeeName: string;
  employeeCode: string;
}

export default function CorrectionsPage() {
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Reject Dialog
  const [rejectingCorrection, setRejectingCorrection] = useState<AttendanceCorrection | null>(null);
  const [remarks, setRemarks] = useState("");

  const fetchCorrections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/attendance-corrections`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCorrections(data);
      }
    } catch (e) {
      console.error("Failed to fetch corrections", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  const handleProcessRequest = async (id: number, status: "approved" | "rejected", rejectRemarks?: string) => {
    try {
      const res = await fetch(`${BASE}/attendance-corrections/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status, remarks: rejectRemarks })
      });
      if (res.ok) {
        setRejectingCorrection(null);
        setRemarks("");
        fetchCorrections();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to process correction");
      }
    } catch (e) {
      console.error(e);
      alert("Error processing correction request");
    }
  };

  const filteredCorrections = corrections.filter(c => {
    const matchesSearch = c.employeeName.toLowerCase().includes(search.toLowerCase()) || 
                          c.reason.toLowerCase().includes(search.toLowerCase()) ||
                          c.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = corrections.length;
  const pendingCount = corrections.filter(c => c.status === "pending").length;
  const approvedCount = corrections.filter(c => c.status === "approved").length;
  const rejectedCount = corrections.filter(c => c.status === "rejected").length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-bold">Attendance Correction Requests</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Approve, reject, or comment on manual shift attendance corrections submitted by employees</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: totalCount, icon: ClipboardCheck, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
          { label: "Pending Approval", value: pendingCount, icon: Clock, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20" },
          { label: "Approved Corrections", value: approvedCount, icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950/20" },
          { label: "Rejected Requests", value: rejectedCount, icon: XCircle, color: "text-red-600 bg-red-50 dark:bg-red-950/20" },
        ].map(card => (
          <Card key={card.label} className="border shadow-sm p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.label}</p>
              <p className="text-2xl font-extrabold mt-1 text-slate-800 dark:text-zinc-100">{card.value}</p>
            </div>
            <div className={cn("p-2.5 rounded-xl", card.color)}>
              <card.icon className="w-5 h-5" />
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4 border shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Search Requests</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, reason..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 w-44">
          <Label className="text-xs text-muted-foreground">Status Filter</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Corrections List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-zinc-800/50">
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-48">Employee</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-28">Shift Date</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-36">Requested Check In/Out</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Reason for correction</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-36">Submitted Date</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-24">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCorrections.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 align-middle">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{c.employeeName}</div>
                      <div className="text-[10px] text-muted-foreground">{c.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{c.date}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap font-semibold text-slate-800 dark:text-zinc-300">
                      {c.requestedCheckIn || "—"} / {c.requestedCheckOut || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-sm break-words">{c.reason}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", STATUS_COLORS[c.status])}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        {c.status === "pending" ? (
                          <>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                if (confirm(`Approve attendance override on ${c.date} for ${c.employeeName}?`)) {
                                  handleProcessRequest(c.id, "approved");
                                }
                              }}>
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs"
                              onClick={() => setRejectingCorrection(c)}>
                              Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic pr-2 capitalize">{c.status}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredCorrections.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/45" />
                      <p className="font-semibold text-sm">No correction requests found</p>
                      <p className="text-xs mt-0.5">Overrides requested from the self-service portal will show up here</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectingCorrection !== null} onOpenChange={open => { if (!open) setRejectingCorrection(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Correction Request</DialogTitle></DialogHeader>
          {rejectingCorrection && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Employee</Label>
                <p className="text-sm font-semibold mt-0.5">{rejectingCorrection.employeeName}</p>
              </div>
              <div>
                <Label>Date</Label>
                <p className="text-sm font-semibold mt-0.5">{rejectingCorrection.date}</p>
              </div>
              <div>
                <Label>Reason / Remarks for Rejection</Label>
                <Input
                  className="mt-1"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Timesheet entries conflict"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => setRejectingCorrection(null)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={() => handleProcessRequest(rejectingCorrection.id, "rejected", remarks)}>
                  Reject Request
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
