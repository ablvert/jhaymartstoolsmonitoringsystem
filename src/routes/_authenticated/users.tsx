import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyRow, Field, Input, Modal, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { adminCreateUser, adminDeleteUser, adminSetPassword, adminUpdateUser } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/data";
import { useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "User management — Jhaymarts Tools Management System" },
      { name: "description", content: "Add, edit and control access for Jhaymarts system users." },
      { property: "og:title", content: "User management — Jhaymarts" },
      { property: "og:description", content: "Manage Jhaymarts system users." },
    ],
  }),
  component: Users,
});

type Form = { id?: string; fullName: string; username: string; password: string; confirm: string; role: "admin" | "user"; status: "Active" | "Inactive" };

function Users() {
  const { isAdmin, profile: me } = useAuth();
  const { data: users = [] } = useProfiles();
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["profiles"] });
  const { notify } = useToast();
  const createFn = useServerFn(adminCreateUser);
  const updateFn = useServerFn(adminUpdateUser);
  const pwFn = useServerFn(adminSetPassword);
  const delFn = useServerFn(adminDeleteUser);
  const [form, setForm] = useState<Form | null>(null);
  const [pw, setPw] = useState<{ user: Profile; value: string } | null>(null);
  const [del, setDel] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return <Panel className="p-[16px] text-[13px]">Only administrators can manage users.</Panel>;

  async function run(fn: () => Promise<unknown>, ok: string, done: () => void) {
    setBusy(true);
    try {
      await fn();
      notify(ok);
      done();
      refresh();
    } catch (e) {
      const raw = (e as Error).message ?? String(e);
      // "Invariant failed" is a TanStack framework error that surfaces when the
      // server-function endpoint returns a response the client cannot decode
      // (e.g. a plain-text 403 from CSRF check, or a 405 from a static host).
      // Translate it into an actionable message instead of exposing the internal term.
      let msg = raw;
      if (
        raw === "Invariant failed" ||
        raw.toLowerCase().includes("invariant") ||
        raw.toLowerCase().includes("content-type")
      ) {
        msg =
          "Could not reach the server. Please make sure you are signed in and try again. " +
          "If the problem persists, reload the page.";
      } else if (raw === "Forbidden" || raw.toLowerCase().includes("forbidden")) {
        msg =
          "Access denied. Your session may have expired — please sign out and sign in again.";
      }
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div>
      <PageHeader
        title="User management"
        breadcrumb="Home / User management"
        actions={<Button onClick={() => setForm({ fullName: "", username: "", password: "", confirm: "", role: "user", status: "Active" })}><Plus size={14} /> Add user</Button>}
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th scope="col">Full name</th><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Last login</th><th scope="col" className="text-right">Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.full_name}</td>
                  <td>{u.username}</td>
                  <td>{u.role === "admin" ? "Administrator" : "User"}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>{formatDateTime(u.last_login)}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" aria-label={`Edit ${u.username}`} onClick={() => setForm({ id: u.id, fullName: u.full_name, username: u.username, password: "", confirm: "", role: u.role, status: u.status as Form["status"] })}><Pencil size={14} /></Button>
                    <Button variant="ghost" aria-label={`Change password for ${u.username}`} onClick={() => setPw({ user: u, value: "" })}><KeyRound size={14} /></Button>
                    <Button variant="ghost" aria-label={`Delete ${u.username}`} disabled={u.id === me?.id} onClick={() => setDel(u)}><Trash2 size={14} className="text-danger" /></Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? <EmptyRow colSpan={6} label="No users" /> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal open={!!form} title={form?.id ? "Edit user" : "Add user"} onClose={() => setForm(null)}>
        {form ? (
          <form
            className="flex flex-col gap-[10px]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.fullName.trim() || !form.username.trim()) return notify("Full name and username are required", "error");
              if (!form.id && form.password.length < 4) return notify("Password must be at least 4 characters", "error");
              if (!form.id && form.password !== form.confirm) return notify("Password and confirm password do not match", "error");
              const safeRole = form.role === "admin" ? "admin" : "user";
              const safeStatus = form.status === "Inactive" ? "Inactive" : "Active";
              if (form.id) {
                void run(() => updateFn({ data: { id: form.id!, fullName: form.fullName, username: form.username, role: safeRole, status: safeStatus } }), "User updated", () => setForm(null));
              } else {
                void run(() => createFn({ data: { fullName: form.fullName, username: form.username, password: form.password, role: safeRole, status: safeStatus } }), "User created successfully.", () => setForm(null));
              }
            }}
          >
            <Field label="Full name" required><Input autoFocus value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
            <Field label="Username" required><Input value={form.username} onChange={(e) => set("username", e.target.value)} /></Field>
            {!form.id ? (
              <Field label="Password" required hint="At least 4 characters.">
                <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />
              </Field>
            ) : null}
            {!form.id ? (
              <Field label="Confirm password" required>
                <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Role">
              <Select value={form.role || "user"} onChange={(e) => set("role", e.target.value)}>
                <option value="user">User</option><option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status || "Active"} onChange={(e) => set("status", e.target.value)}>
                <option value="Active">Active</option><option value="Inactive">Inactive</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-[6px]">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>Save user</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!pw} title={`Change password — ${pw?.user.username ?? ""}`} onClose={() => setPw(null)}>
        <form className="flex flex-col gap-[10px]" onSubmit={(e) => { e.preventDefault(); if (pw) void run(() => pwFn({ data: { id: pw.user.id, password: pw.value } }), "Password changed", () => setPw(null)); }}>
          <Field label="New password" required hint="At least 4 characters">
            <Input type="password" autoFocus value={pw?.value ?? ""} onChange={(e) => setPw((p) => (p ? { ...p, value: e.target.value } : p))} />
          </Field>
          <div className="flex justify-end gap-[6px]">
            <Button type="button" variant="secondary" onClick={() => setPw(null)}>Cancel</Button>
            <Button type="submit" disabled={busy}>Change password</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!del} title="Delete user" onClose={() => setDel(null)}>
        <p className="text-[13px]">Delete user <strong>{del?.username}</strong>? This cannot be undone.</p>
        <div className="mt-[14px] flex justify-end gap-[6px]">
          <Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => del && void run(() => delFn({ data: { id: del.id } }), "User deleted", () => setDel(null))}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
