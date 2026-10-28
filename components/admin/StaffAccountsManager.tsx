"use client";

import { useState } from "react";
import {
  createStaffAccountAction,
  updateStaffRoleAction,
  deleteStaffAccountAction,
} from "@/app/(admin)/admin/actions";

type AdminUser = {
  user_id: string;
  email: string;
  role: "owner" | "staff";
  created_at: string;
};

export function StaffAccountsManager({
  users = [],
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("role", role);

      await createStaffAccountAction(formData);
      setEmail("");
      setPassword("");
      setRole("staff");
    } catch (err: any) {
      setError(err?.message || "Failed to create staff account.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = async (userId: string, currentRole: "owner" | "staff") => {
    const nextRole = currentRole === "owner" ? "staff" : "owner";
    if (!confirm(`Change role of this user to ${nextRole.toUpperCase()}?`)) return;

    setLoading(true);
    try {
      await updateStaffRoleAction(userId, nextRole);
    } catch (err: any) {
      alert(err?.message || "Failed to change role");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string, uEmail: string) => {
    if (!confirm(`Revoke admin access for ${uEmail}? They will no longer be able to log in.`)) return;

    setLoading(true);
    try {
      await deleteStaffAccountAction(userId);
    } catch (err: any) {
      alert(err?.message || "Failed to remove staff account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Existing Staff Users List (2 Cols) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0B1F23]">Authorized Administrators</h2>
          <span className="text-xs text-neutral-400">{users.length} accounts</span>
        </div>

        <div className="divide-y divide-neutral-100">
          {users.map((u) => {
            const isMe = u.user_id === currentUserId;
            return (
              <div key={u.user_id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0B1F23]">{u.email}</span>
                    {isMe && (
                      <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-bold">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Added: {new Date(u.created_at).toLocaleDateString("en-EG", { dateStyle: "medium" })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      u.role === "owner"
                        ? "bg-[#0E7C89]/10 text-[#0E7C89] border border-[#0E7C89]/20"
                        : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                    }`}
                  >
                    {u.role}
                  </span>

                  {!isMe && (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleRoleToggle(u.user_id, u.role)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors"
                      >
                        Make {u.role === "owner" ? "Staff" : "Owner"}
                      </button>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleDelete(u.user_id, u.email)}
                        className="px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add New Staff Account Form (1 Col) */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-[#0B1F23]">Create New Account</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            The new user will be required to configure TOTP two-factor authentication upon first login.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@akmshoes.com"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Initial Password *
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-[#0E7C89]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white font-medium"
            >
              <option value="staff">Staff (Orders & Catalog Management)</option>
              <option value="owner">Owner (Full Store & Financial Control)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#0E7C89] hover:bg-[#0b646f] text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Admin Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
