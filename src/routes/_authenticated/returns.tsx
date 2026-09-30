import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button, EmptyRow, Field, Input, PageHeader, Panel, PanelHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { nameById, useAreas, useDepartments, useRefreshAll, useReturns, useTools, useTransfers } from "@/lib/data";
import { formatDateTime, nowLocalInput } from "@/lib/format";
import { recordReturn } from "@/lib/mutations";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({
    meta: [
      { title: "Tool return — Jhaymarts Tools Management System" },
      { name: "description", content: "Record full or partial returns of borrowed Jhaymarts tools." },
      { property: "og:title", content: "Tool return — Jhaymarts" },
      { property: "og:description", content: "Record full or partial tool returns." },
    ],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: returns = [] } = useReturns();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();
  const refresh = useRefreshAll();
  const { notify } = useToast();

  const blank = () => ({
    transferId: "",
    quantity: "1",
    returnFromId: "",   // where the tool is coming FROM (= where it was transferred TO)
    returnedToId: "",   // the department receiving it back
    returnedToAreaId: "", // the physical area where it's returned
    returnedBy: "",
    receivedBy: "",
    returnedAt: nowLocalInput(),
    condition: "Good",
    notes: "",
  });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setF((p) => ({ ...p, [k]: v }));

  const open = transfers.filter((t) => t.quantity - t.returned_quantity > 0);

  // When a transfer is selected, pre-fill the "Transfer From" with the dept it was sent TO
  const transfer = open.find((t) => t.id === f.transferId);
  const outstanding = transfer ? transfer.quantity - transfer.returned_quantity : 0;

  function onTransferSelect(id: string) {
    const t = open.find((x) => x.id === id);
    setF((prev) => ({
      ...prev,
      transferId: id,
      quantity: "1",
      // "Transfer From" on return = the dept it was sent TO (where the tool currently is)
      returnFromId: t?.transfer_to_department_id ?? "",
      // Default "Return To" = original source department
      returnedToId: t?.transfer_from_department_id ?? "",
      returnedToAreaId: "",
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!transfer) return notify("Select a borrowed tool", "error");
    if (!f.returnFromId) return notify("Select the Transfer From department", "error");
    if (!f.returnedToId) return notify("Select the Returned To department", "error");
    if (!f.returnedToAreaId) return notify("Select the Returned To area", "error");
    if (!f.returnedBy.trim()) return notify("Returned by is required", "error");
    if (!f.receivedBy.trim()) return notify("Received by is required", "error");
    const tool = tools.find((t) => t.id === transfer.tool_id);
    if (!tool) return notify("Tool not found", "error");
    setBusy(true);
    try {
      await recordReturn({
        transfer, tool,
        quantity: Number(f.quantity),
        returnFromDeptId: f.returnFromId,
        returnedToDeptId: f.returnedToId,
        returnedToAreaId: f.returnedToAreaId,
        returnedBy: f.returnedBy,
        receivedBy: f.receivedBy,
        returnedAt: f.returnedAt,
        condition: f.condition,
        notes: f.notes,
      });
      notify("Return recorded");
      setF(blank());
      refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Tool return" breadcrumb="Home / Tool return" />
      <div className="grid gap-[14px] xl:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="Record return" />
          <form onSubmit={submit} className="flex flex-col gap-[10px] p-[12px]">
            <Field label="Borrowed tool" required>
              <Select value={f.transferId} onChange={(e) => onTransferSelect(e.target.value)}>
                <option value="">Select borrowed tool</option>
                {open.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nameById(tools as any, t.tool_id)} — {nameById(departments, t.transfer_to_department_id)} ({t.quantity - t.returned_quantity} outstanding)
                  </option>
                ))}
              </Select>
            </Field>

            {transfer && (
              <div className="rounded-[6px] bg-muted px-[10px] py-[7px] text-[12px] space-y-1">
                <div>
                  Transfer route: <strong>{nameById(departments, transfer.transfer_from_department_id)}</strong>
                  {" → "}
                  <strong>{nameById(departments, transfer.transfer_to_department_id)}</strong>
                  {transfer.transfer_to_area_id ? ` (${nameById(areas, transfer.transfer_to_area_id)})` : ""}
                </div>
                <div>Borrowed by: <strong>{transfer.borrowed_by}</strong></div>
              </div>
            )}

            <Field label="Transfer From (returning from)" required hint="The department the tool is currently in">
              <Select value={f.returnFromId} onChange={(e) => set("returnFromId", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Returned To (department)" required hint="Where the tool is being returned to">
              <Select value={f.returnedToId} onChange={(e) => set("returnedToId", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Returned To Area" required>
              <Select value={f.returnedToAreaId} onChange={(e) => set("returnedToAreaId", e.target.value)}>
                <option value="">Select area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Quantity returned" required hint={transfer ? `Up to ${outstanding} (partial returns allowed)` : undefined}>
              <Input type="number" min={1} max={outstanding || undefined} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label="Returned by" required>
              <Input value={f.returnedBy} onChange={(e) => set("returnedBy", e.target.value)} />
            </Field>
            <Field label="Received by" required>
              <Input value={f.receivedBy} onChange={(e) => set("receivedBy", e.target.value)} />
            </Field>
            <Field label="Date & time returned" required>
              <Input type="datetime-local" value={f.returnedAt} onChange={(e) => set("returnedAt", e.target.value)} />
            </Field>
            <Field label="Condition">
              <Select value={f.condition} onChange={(e) => set("condition", e.target.value)}>
                <option>Good</option><option>Damaged</option><option>Needs Repair</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record return"}</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Return history"
            actions={
              <Button variant="secondary" onClick={() => exportToExcel(returns.map((r) => {
                const tr = transfers.find((t) => t.id === r.transfer_id);
                return {
                  Tool: nameById(tools as any, r.tool_id),
                  Quantity: r.quantity,
                  "Transfer From": nameById(departments, tr?.transfer_to_department_id ?? null),
                  "Returned To": nameById(departments, r.department_id),
                  "Returned To Area": nameById(areas, r.area_id),
                  "Returned by": r.returned_by,
                  "Received by": r.received_by,
                  "Date returned": formatDateTime(r.returned_at),
                  Condition: r.condition,
                  Notes: r.notes ?? "",
                };
              }), "Returns", "jhaymarts-returns")}>
                <Download size={14} /> Excel
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Transfer From</th>
                  <th scope="col">Returned To</th>
                  <th scope="col">Returned To Area</th>
                  <th scope="col">Returned by</th>
                  <th scope="col">Received by</th>
                  <th scope="col">Date & time</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => {
                  const tr = transfers.find((t) => t.id === r.transfer_id);
                  const transferFromDept = nameById(departments, tr?.transfer_to_department_id ?? null);
                  return (
                    <tr key={r.id}>
                      <td className="font-medium">{nameById(tools as any, r.tool_id)}</td>
                      <td>{r.quantity}</td>
                      <td>{transferFromDept || nameById(departments, r.department_id)}</td>
                      <td>{nameById(departments, r.department_id)}</td>
                      <td>{nameById(areas, r.area_id)}</td>
                      <td>{r.returned_by}</td>
                      <td>{r.received_by}</td>
                      <td>{formatDateTime(r.returned_at)}</td>
                      <td><StatusBadge status={r.condition} /></td>
                      <td>{r.notes ?? "—"}</td>
                    </tr>
                  );
                })}
                {returns.length === 0 ? <EmptyRow colSpan={10} label="No returns recorded" /> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
