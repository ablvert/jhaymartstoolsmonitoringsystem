import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyRow, Field, Input, Modal, PageHeader, Panel, Select, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { nameById, useAreas, useDepartments, useRefreshAll, useTools, useTransfers } from "@/lib/data";
import { toolStatus, type Tool } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { exportToExcel } from "@/lib/export";
import { db } from "@/lib/mutations";
import { logActivity } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/inventory")({
  validateSearch: (s: Record<string, unknown>): { status?: string | undefined } => ({
    status: typeof s["status"] === "string" ? s["status"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tools inventory — Jhaymarts Tools Management System" },
      { name: "description", content: "Add, edit and track every Jhaymarts tool with live availability." },
      { property: "og:title", content: "Tools inventory — Jhaymarts" },
      { property: "og:description", content: "Every tool with live availability and status." },
    ],
  }),
  component: Inventory,
});

type Form = {
  id?: string;
  name: string;
  description: string;
  quantity: string;
  unit_cost: string;
  department_id: string;
  area_id: string;
  date_purchased: string;
  supplier: string;
  needs_repair: boolean;
};

const empty: Form = {
  name: "",
  description: "",
  quantity: "1",
  unit_cost: "0",
  department_id: "",
  area_id: "",
  date_purchased: "",
  supplier: "",
  needs_repair: false,
};

function Inventory() {
  const search = Route.useSearch();
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();
  const refresh = useRefreshAll();
  const { notify } = useToast();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(search.status ?? "");
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Tool | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      tools
        .map((t) => ({ tool: t, status: toolStatus(t, transfers) }))
        .filter(
          ({ tool, status: s }) =>
            (!status || s === status) &&
            (!q ||
              `${tool.name} ${tool.description ?? ""} ${tool.supplier ?? ""}`
                .toLowerCase()
                .includes(q.toLowerCase())),
        ),
    [tools, transfers, q, status],
  );

  async function save() {
    if (!form) return;
    const quantity = Number(form.quantity);
    if (!form.name.trim()) return notify("Tool name is required", "error");
    if (!Number.isInteger(quantity) || quantity < 0) return notify("Quantity must be a whole number", "error");
    if (!form.department_id || !form.area_id) return notify("Department and area are required", "error");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        quantity,
        unit_cost: Number(form.unit_cost) || 0,
        department_id: form.department_id,
        area_id: form.area_id,
        date_purchased: form.date_purchased || null,
        supplier: form.supplier || null,
        needs_repair: form.needs_repair,
      };
      if (form.id) {
        const prev = tools.find((t) => t.id === form.id)!;
        const borrowed = prev.quantity - prev.available_quantity;
        if (quantity < borrowed) throw new Error(`${borrowed} unit(s) are currently borrowed`);
        const { error } = await db
          .from("tools")
          .update({ ...payload, available_quantity: quantity - borrowed })
          .eq("id", form.id);
        if (error) throw new Error(error.message);
        await logActivity("Edit tool", payload.name);
      } else {
        const { error } = await db.from("tools").insert({ ...payload, available_quantity: quantity });
        if (error) throw new Error(error.message);
        await logActivity("Add tool", payload.name);
      }
      notify(form.id ? "Tool updated" : "Tool added");
      setForm(null);
      refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await db.from("tools").delete().eq("id", toDelete.id);
    setBusy(false);
    if (error) return notify(error.message, "error");
    await logActivity("Delete tool", toDelete.name);
    notify("Tool deleted");
    setToDelete(null);
    refresh();
  }

  function exportRows() {
    exportToExcel(
      rows.map(({ tool, status: s }) => ({
        "Tool name": tool.name,
        Description: tool.description ?? "",
        Quantity: tool.quantity,
        Available: tool.available_quantity,
        "Unit cost": Number(tool.unit_cost),
        "Total value": Number(tool.unit_cost) * tool.quantity,
        Department: nameById(departments, tool.department_id),
        Area: nameById(areas, tool.area_id),
        Supplier: tool.supplier ?? "",
        "Date purchased": tool.date_purchased ?? "",
        Status: s,
      })),
      "Tools inventory",
      "jhaymarts-tools-inventory",
    );
  }

  const set = (k: keyof Form, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <div>
      <PageHeader
        title="Tools inventory"
        breadcrumb="Home / Tools inventory"
        actions={
          <>
            <Button variant="secondary" onClick={exportRows}>
              <Download size={14} /> Export to Excel
            </Button>
            <Button onClick={() => setForm({ ...empty })}>
              <Plus size={14} /> Add tool
            </Button>
          </>
        }
      />
      <Panel>
        <div className="flex flex-wrap gap-[8px] border-b border-border p-[10px]">
          <Input
            aria-label="Search tools"
            placeholder="Search by name, description or supplier"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-[320px]"
          />
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
            <option value="">All statuses</option>
            {["Available", "Partially Borrowed", "Fully Borrowed", "Overdue", "Needs Repair"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <span className="ml-auto self-center text-[12px] text-muted-foreground">{rows.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tool name</th>
                <th scope="col">Qty</th>
                <th scope="col">Available</th>
                <th scope="col">Unit cost</th>
                <th scope="col">Department</th>
                <th scope="col">Area</th>
                <th scope="col">Supplier</th>
                <th scope="col">Purchased</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ tool, status: s }) => (
                <tr key={tool.id}>
                  <td>
                    <div className="font-medium">{tool.name}</div>
                    {tool.description ? <div className="text-[12px] text-muted-foreground">{tool.description}</div> : null}
                  </td>
                  <td>{tool.quantity}</td>
                  <td>{tool.available_quantity}</td>
                  <td>₱{formatMoney(Number(tool.unit_cost))}</td>
                  <td>{nameById(departments, tool.department_id)}</td>
                  <td>{nameById(areas, tool.area_id)}</td>
                  <td>{tool.supplier ?? "—"}</td>
                  <td>{formatDate(tool.date_purchased)}</td>
                  <td><StatusBadge status={s} /></td>
                  <td className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      aria-label={`Edit ${tool.name}`}
                      onClick={() =>
                        setForm({
                          id: tool.id,
                          name: tool.name,
                          description: tool.description ?? "",
                          quantity: String(tool.quantity),
                          unit_cost: String(tool.unit_cost),
                          department_id: tool.department_id ?? "",
                          area_id: tool.area_id ?? "",
                          date_purchased: tool.date_purchased ?? "",
                          supplier: tool.supplier ?? "",
                          needs_repair: tool.needs_repair,
                        })
                      }
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" aria-label={`Delete ${tool.name}`} onClick={() => setToDelete(tool)}>
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <EmptyRow colSpan={10} label="No tools match your filters" /> : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal open={!!form} title={form?.id ? "Edit tool" : "Add tool"} onClose={() => setForm(null)} wide>
        {form ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="grid gap-[10px] sm:grid-cols-2"
          >
            <Field label="Tool name" required>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </Field>
            <Field label="Supplier">
              <Input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} />
            </Field>
            <Field label="Quantity" required>
              <Input type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label="Unit cost (₱)">
              <Input type="number" min={0} step="0.01" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} />
            </Field>
            <Field label="Department" required>
              <Select value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Area" required>
              <Select value={form.area_id} onChange={(e) => set("area_id", e.target.value)}>
                <option value="">Select area</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Date purchased">
              <Input type="date" value={form.date_purchased} onChange={(e) => set("date_purchased", e.target.value)} />
            </Field>
            <label className="flex items-center gap-[8px] self-end pb-[8px] text-[13px]">
              <input type="checkbox" checked={form.needs_repair} onChange={(e) => set("needs_repair", e.target.checked)} />
              Needs repair
            </label>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
            <div className="flex justify-end gap-[6px] sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save tool"}</Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={!!toDelete} title="Delete tool" onClose={() => setToDelete(null)}>
        <p className="text-[13px]">
          Delete <strong>{toDelete?.name}</strong>? Its transfer and return history will also be removed. This cannot be undone.
        </p>
        <div className="mt-[14px] flex justify-end gap-[6px]">
          <Button variant="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => void remove()}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
