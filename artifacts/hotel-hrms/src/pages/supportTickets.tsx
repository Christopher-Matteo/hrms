import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, Clock, CheckCircle2, XCircle, Search, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = (import.meta as any).env.VITE_API_URL && !(import.meta as any).env.VITE_API_URL.includes("railway.app") ? ((import.meta as any).env.VITE_API_URL.replace(/\/+$/, "") + "/api") : "/api";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
  resolved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
  closed: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700/50",
};

interface SupportTicket {
  id: number;
  employeeId: number;
  category: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  employeeName: string;
  employeeCode: string;
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/admin/support-tickets`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error("Failed to fetch support tickets", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`${BASE}/admin/support-tickets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchTickets();
      } else {
        alert("Failed to update status");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating status");
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.employeeName.toLowerCase().includes(search.toLowerCase()) || 
                          t.title.toLowerCase().includes(search.toLowerCase()) ||
                          t.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ? true : t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === "open").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const resolvedCount = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-xl font-bold">Support & HR Tickets</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage and resolve complaints, credentials queries, and payroll discrepancies filed by staff</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", value: totalCount, icon: HelpCircle, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20" },
          { label: "Pending Open", value: openCount, icon: Clock, color: "text-red-600 bg-red-50 dark:bg-red-950/20" },
          { label: "In Progress", value: inProgressCount, icon: MessageSquare, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20" },
          { label: "Resolved / Closed", value: resolvedCount, icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950/20" },
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
          <Label className="text-xs text-muted-foreground">Search Tickets</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, subject..."
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
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-zinc-800/50">
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-48">Employee</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-32">Category</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider">Subject & Description</th>
                  <th className="text-left px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-36">Submitted Date</th>
                  <th className="text-center px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-28">Status</th>
                  <th className="text-right px-4 py-3 font-bold text-muted-foreground uppercase tracking-wider w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(t => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30 align-top">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-zinc-200">{t.employeeName}</div>
                      <div className="text-[10px] text-muted-foreground">{t.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] uppercase font-semibold">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-800 dark:text-zinc-200 mb-0.5">{t.title}</div>
                      <div className="text-muted-foreground leading-relaxed break-words max-w-lg">{t.description}</div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", STATUS_COLORS[t.status])}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1.5 justify-end">
                        {t.status === "open" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => handleUpdateStatus(t.id, "in_progress")}>
                            Start Progress
                          </Button>
                        )}
                        {["open", "in_progress"].includes(t.status) && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleUpdateStatus(t.id, "resolved")}>
                            Mark Resolved
                          </Button>
                        )}
                        {t.status === "resolved" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-gray-500 hover:bg-gray-50"
                            onClick={() => handleUpdateStatus(t.id, "closed")}>
                            Close Ticket
                          </Button>
                        )}
                        {t.status === "closed" && (
                          <span className="text-[10px] text-muted-foreground italic pr-2">Resolved & Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredTickets.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground/45" />
                      <p className="font-semibold text-sm">No support tickets found</p>
                      <p className="text-xs mt-0.5">Tickets created by employees will show up here</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
