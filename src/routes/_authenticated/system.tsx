import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button, Field, Input, Modal, PageHeader, Panel, PanelHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth, logActivity } from "@/lib/auth";
import { useActivityLogs, useRefreshAll } from "@/lib/data";
import { db } from "@/lib/mutations";
import { downloadJson } from "@/lib/export";
import { formatDateTime } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/system")({
  head: () => ({
    meta: [
      { title: "System — Jhaymarts Tools Management System" },
      { name: "description", content: "Backup, restore and maintenance for the Jhaymarts tools database." },
      { property: "og:title", content: "System — Jhaymarts" },
      { property: "og:description", content: "Backup, restore and maintenance." },
    ],
  }),
  component: SystemPage,
});

const TABLES = ["departments", "areas", "tools", "tool_transfers", "tool_returns"] as const;

function SystemPage() {
  const { isAdmin } = useAuth();
  const { notify } = useToast();
  const refresh = useRefreshAll();
  const { data: logs = [] } = useActivityLogs(isAdmin);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<any>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState<string | null>(null);

  if (!isAdmin)
    return <Panel className="p-[16px] text-[13px]">Only administrators can access system maintenance.</Panel>;

  async function backup() {
    const out: Record<string, unknown> = { app: "jhaymarts-tools", created_at: new Date().toISOString() };
    for (const t of TABLES) {
      const { data, error } = await db.from(t).select("*");
      if (error) return notify(error.message, "error");
      out[t] = data;
    }
    downloadJson(out, "jhaymarts-backup");
    await logActivity("Backup", "Downloaded system backup");
    notify("Backup downloaded");
  }

  async function onFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!TABLES.every((t) => Array.isArray(parsed[t]))) throw new Error("This file is not a valid Jhaymarts backup");
      setPending(parsed);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function restore() {
    setBusy(true);
    try {
      const b = pending;
      if (!b || !Array.isArray(b.tools)) throw new Error("Invalid backup");
      const wipe = "00000000-0000-0000-0000-000000000000";
      for (const t of ["tool_returns", "tool_transfers", "tools", "departments", "areas"]) {
        await db.from(t).delete().neq("id", wipe);
      }
      if (b.departments?.length) await db.from("departments").insert(b.departments);
      if (b.areas?.length) await db.from("areas").insert(b.areas);
      if (b.tools?.length) await db.from("tools").insert(b.tools);
      if (b.tool_transfers?.length) await db.from("tool_transfers").insert(b.tool_transfers);
      if (b.tool_returns?.length) await db.from("tool_returns").insert(b.tool_returns);
      await logActivity("Restore", "Restored system backup");
      notify("Backup restored");
      setPending(null);
      refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    setBusy(true);
    try {
      const wipe = "00000000-0000-0000-0000-000000000000";
      await db.from("tool_returns").delete().neq("id", wipe);
      await db.from("tool_transfers").delete().neq("id", wipe);
      await db.from("tools").delete().neq("id", wipe);
      await logActivity("Delete all data", "All tools, transfers and returns deleted");
      notify("All data deleted");
      setDelOpen(false);
      setConfirmText("");
      refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function applyMigration() {
    setBusy(true);
    setMigrateStatus("Applying schema migration...");
    try {
      const { data, error } = await supabase.functions.invoke("admin-ops", {
        body: { action: "apply_migration", payload: {} },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setMigrateStatus("✅ Migration applied successfully! Please refresh the page.");
      notify("Schema migration applied successfully", "success");
    } catch (e) {
      const msg = (e as Error).message;
      setMigrateStatus(`❌ ${msg}`);
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="System" breadcrumb="Home / System" />
      <div className="grid gap-[14px] lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Backup" />
          <div className="p-[12px] text-[13px]">
            <p className="mb-[10px] text-muted-foreground">Download all departments, areas, tools, transfers and returns as a file.</p>
            <Button onClick={() => void backup()}>Download backup</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Restore" />
          <div className="p-[12px] text-[13px]">
            <p className="mb-[10px] text-muted-foreground">Replace current data with a previously downloaded backup.</p>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Choose backup file</Button>
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Delete all data" />
          <div className="p-[12px] text-[13px]">
            <p className="mb-[10px] text-muted-foreground">Permanently remove all tools, transfers and returns.</p>
            <Button variant="danger" onClick={() => setDelOpen(true)}>Delete all data</Button>
          </div>
        </Panel>
      </div>

      <div className="mt-[14px] grid gap-[14px] lg:grid-cols-1">
        <Panel>
          <PanelHeader title="Schema Migration" />
          <div className="p-[12px] text-[13px]">
            <p className="mb-[10px] text-muted-foreground">
              Apply the latest database schema updates (adds area tracking to transfers and returns).
              Run this once after deploying a new version that includes schema changes.
            </p>
            {migrateStatus && (
              <p className="mb-[10px] rounded bg-muted px-3 py-2 text-[12px] font-mono">{migrateStatus}</p>
            )}
            <Button variant="secondary" disabled={busy} onClick={() => void applyMigration()}>
              {busy ? "Applying…" : "Apply schema migration"}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="mt-[14px]">
        <PanelHeader title="Activity log" />
        <div className="max-h-[420px] overflow-auto">
          <table className="data-table">
            <thead><tr><th scope="col">Date & time</th><th scope="col">User</th><th scope="col">Action</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id}><td>{formatDateTime(l.created_at)}</td><td>{l.username ?? "—"}</td><td className="font-medium">{l.action}</td><td>{l.details ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal open={!!pending} title="Restore backup" onClose={() => setPending(null)}>
        <p className="text-[13px]">
          This replaces all current data with the backup ({pending?.tools?.length ?? 0} tools, {pending?.tool_transfers?.length ?? 0} transfers). Continue?
        </p>
        <div className="mt-[14px] flex justify-end gap-[6px]">
          <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void restore()}>{busy ? "Restoring…" : "Restore"}</Button>
        </div>
      </Modal>

      <Modal open={delOpen} title="Delete all data" onClose={() => setDelOpen(false)}>
        <Field label='Type "DELETE ALL DATA" to confirm'>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
        </Field>
        <div className="mt-[14px] flex justify-end gap-[6px]">
          <Button variant="secondary" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button variant="danger" disabled={busy || confirmText !== "DELETE ALL DATA"} onClick={() => void deleteAll()}>Delete everything</Button>
        </div>
      </Modal>
    </div>
  );
}
