import { useGetAuditLogs } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  created: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  deleted: "bg-red-100 text-red-700",
  approved: "bg-purple-100 text-purple-700",
  rejected: "bg-orange-100 text-orange-700",
};

export default function AuditLogsPage() {
  const { data: logs, isLoading } = useGetAuditLogs();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">{logs?.length ?? 0} activity records</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Changes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs?.map(log => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{log.userName ?? "System"}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700")}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {log.entity}{log.entityId ? ` #${log.entityId}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs max-w-xs truncate">
                      {log.changes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
                {!logs?.length && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <ScrollText className="w-8 h-8 mx-auto mb-2" />
                    No audit logs found
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
