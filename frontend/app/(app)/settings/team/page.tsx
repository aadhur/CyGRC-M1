"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { apiFetch } from "@/lib/api/client";
import { Plus, Trash2, X, CircleAlert, Loader2 } from "lucide-react";
import { ConfirmModal } from "@/components/ConfirmModal";

interface TeamMember {
  user_id: string;
  email: string;
  role: string;
  status: string;
}

export default function TeamPage() {
  const { user: currentUser, can } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    password: "",
    role: "COMPLIANCE_MANAGER",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      const data = await apiFetch<{ users: TeamMember[] }>("/v1/users");
      setMembers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Failed to load team roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/v1/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      setInviteOpen(false);
      setInviteForm({ email: "", password: "", role: "COMPLIANCE_MANAGER" });
      fetchMembers();
    } catch (err: any) {
      alert(err.message || "Failed to invite member.");
    }
  };

const [userToDelete, setUserToDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/v1/users/${userToDelete.user_id}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.user_id !== userToDelete.user_id));
      setUserToDelete(null);
    } catch (err: any) {
      alert(err.message || "Failed to remove user.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono font-semibold tracking-wider text-brand-orange uppercase">
            WORKSPACE ACCESS
          </p>
          <h1 className="text-2xl font-heading font-bold text-slate-100 mt-1">
            Team Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage roles, access permissions, and governance assignments.
          </p>
        </div>

        {can(["users:write"]) && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold rounded-xl shadow transition-colors"
          >
            <Plus size={16} />
            <span>Invite Member</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <CircleAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-16 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading team members...</span>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-raised/60 text-xs font-mono uppercase text-slate-400 border-b border-border">
              <tr>
                <th className="px-6 py-4">Member Email</th>
                <th className="px-6 py-4">Assigned Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => {
                const isCurrent = member.user_id === currentUser?.userId;
                return (
                  <tr key={member.user_id} className="hover:bg-surface-raised/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {member.email}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-brand-orange/20 text-brand-orange">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-raised border border-border text-slate-300">
                        {member.role.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {can(["users:delete"]) && !isCurrent && member.role !== "TENANT_ADMIN" && (
                        <button
                          onClick={() => setUserToDelete(member)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Remove user"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setInviteOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-100"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-heading font-semibold text-slate-100 mb-4">
              Invite Team Member
            </h3>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role Assignment</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                >
                  <option value="COMPLIANCE_MANAGER">Compliance Manager</option>
                  <option value="INTERNAL_AUDITOR">Internal Auditor</option>
                  <option value="RISK_OWNER">Risk Owner</option>
                  <option value="CISO">CISO</option>
                  <option value="DPO">DPO</option>
                  <option value="ENGINEERING_LEAD">Engineering Lead</option>
                  <option value="USER">User</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Temporary Initial Password</label>
                <input
                  required
                  minLength={8}
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 bg-surface-raised border border-border rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-orange"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-sm font-semibold rounded-xl"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destructive ConfirmModal for Member Deletion */}
      <ConfirmModal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${userToDelete?.email}? Their access to this workspace will be immediately revoked.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
