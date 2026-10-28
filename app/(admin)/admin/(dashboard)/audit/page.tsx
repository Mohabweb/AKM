import { requireAdmin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminAuditPage() {
  await requireAdmin("owner");
  const sb = await sessionClient();

  const { data: logs } = await sb
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1F23]">
          Audit Log
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Owner-only security trail. Automatically records who created, modified, or deleted store data.
        </p>
      </div>

      {!logs || logs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center text-neutral-400">
          <span className="text-4xl block mb-2">📜</span>
          <p className="text-sm font-medium">No audit logs recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200/80 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 font-medium">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-EG", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-neutral-800">
                    {log.actor_email || "System / Service"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        log.action === "delete"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : log.action === "insert"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : log.action === "status"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-neutral-700">
                    <strong>{log.entity}</strong>
                    {log.entity_id && (
                      <span className="text-neutral-400 font-mono text-[11px] block truncate max-w-xs">
                        #{log.entity_id}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {log.detail ? (
                      <details className="cursor-pointer text-[11px]">
                        <summary className="text-[#0E7C89] font-semibold hover:underline">
                          View details
                        </summary>
                        <pre className="mt-1 p-2 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-[10px] max-w-md overflow-x-auto">
                          {JSON.stringify(log.detail, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
