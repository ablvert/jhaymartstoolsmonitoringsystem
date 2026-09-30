import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button, EmptyRow, Field, Input, PageHeader, Panel, PanelHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import { nameById, useAreas, useDepartments, useRefreshAll, useTools, useTransfers } from "@/lib/data";
import { transferStatus } from "@/lib/domain";
import { formatDateTime, nowLocalInput } from "@/lib/format";
import { recordTransfer } from "@/lib/mutations";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/transfer")({
  head: () => ({
    meta: [
      { title: "Tool transfer — Jhaymarts Tools Management System" },
      { name: "description", content: "Record tools borrowed between Jhaymarts departments." },
      { property: "og:title", content: "Tool transfer — Jhaymarts" },
      { property: "og:description", content: "Record tools borrowed between departments." },
    ],
  }),
  component: TransferPage,
});

function TransferPage() {
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();
  const refresh = useRefreshAll();
  const { notify } = useToast();

  const blank = () => ({
    toolId: "", quantity: "1", fromId: "", toId: "", toAreaId: "", borrowedBy: "", borrowedAt: nowLocalInput(),
    expected: "", description: "", reason: "",
  });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  
  const tool = tools.find((t) => t.id === f.toolId);
  const set = (k: keyof ReturnType<typeof blank>, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tool) return notify("Select a tool", "error");
    if (!f.fromId) return notify("Select the source department", "error");
    if (!f.toId) return notify("Select the destination department", "error");
    if (!f.toAreaId) return notify("Select the destination area", "error");
    if (!f.borrowedBy.trim()) return notify("Borrowed by is required", "error");
    if (!f.expected) return notify("Expected return date is required", "error");
    setBusy(true);
    try {
      await recordTransfer({
        tool, quantity: Number(f.quantity), fromId: f.fromId, toId: f.toId, toAreaId: f.toAreaId,
        borrowedBy: f.borrowedBy, borrowedAt: f.borrowedAt, expectedReturnAt: f.expected,
        description: f.description, reason: f.reason,
      });
      notify("Transfer recorded");
      setF(blank());
      refresh();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const rows = transfers.filter((t) =>
    !q || `${nameById(tools as any, t.tool_id)} ${t.borrowed_by}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Tool transfer" breadcrumb="Home / Tool transfer" />
      <div className="grid gap-[14px] xl:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="New transfer" />
          <form onSubmit={submit} className="flex flex-col gap-[10px] p-[12px]">
            <Field label="Tool" required>
              <Select value={f.toolId} onChange={(e) => {
                const newTool = tools.find(t => t.id === e.target.value);
                setF(prev => ({ 
                  ...prev, 
                  toolId: e.target.value, 
                  fromId: newTool?.current_department_id || newTool?.department_id || "" 
                }));
              }}>
                <option value="">Select tool</option>
                {tools.map((t) => (
                  <option key={t.id} value={t.id} disabled={t.available_quantity < 1}>
                    {t.name} ({t.available_quantity} available)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Transfer from" required hint="The tool's current department">
              <Select value={f.fromId} onChange={(e) => set("fromId", e.target.value)}>
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Transfer to" required>
              <Select value={f.toId} onChange={(e) => set("toId", e.target.value)}>
                <option value="">Select department</option>
                {departments.filter((d) => d.id !== f.fromId).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Transfer to area" required>
              <Select value={f.toAreaId} onChange={(e) => set("toAreaId", e.target.value)}>
                <option value="">Select area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" required hint={tool ? `Max ${tool.available_quantity}` : undefined}>
              <Input type="number" min={1} max={tool?.available_quantity} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <Field label="Borrowed by" required>
              <Input value={f.borrowedBy} onChange={(e) => set("borrowedBy", e.target.value)} />
            </Field>
            <Field label="Date & time borrowed" required>
              <Input type="datetime-local" value={f.borrowedAt} onChange={(e) => set("borrowedAt", e.target.value)} />
            </Field>
            <Field label="Expected return" required>
              <Input type="datetime-local" value={f.expected} onChange={(e) => set("expected", e.target.value)} />
            </Field>
            <Field label="Reason">
              <Input value={f.reason} onChange={(e) => set("reason", e.target.value)} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Record transfer"}</Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Transfer history"
            actions={
              <div className="flex gap-[6px]">
                <Input aria-label="Search transfers" placeholder="Search tool or borrower" value={q} onChange={(e) => setQ(e.target.value)} className="w-[200px]" />
                <Button variant="secondary" onClick={() => exportToExcel(rows.map((t) => ({
                  Tool: nameById(tools as any, t.tool_id), Quantity: t.quantity, Returned: t.returned_quantity,
                  From: nameById(departments, t.transfer_from_department_id), To: nameById(departments, t.transfer_to_department_id),
                  "To Area": nameById(areas, t.transfer_to_area_id),
                  "Borrowed by": t.borrowed_by, "Borrowed at": formatDateTime(t.borrowed_at),
                  "Expected return": formatDateTime(t.expected_return_at), Status: transferStatus(t),
                })), "Transfers", "jhaymarts-transfers")}>
                  <Download size={14} /> Excel
                </Button>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th><th scope="col">Qty</th><th scope="col">Returned</th>
                  <th scope="col">From</th><th scope="col">To</th><th scope="col">To Area</th><th scope="col">Borrowed by</th>
                  <th scope="col">Borrowed</th><th scope="col">Expected return</th><th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{nameById(tools as any, t.tool_id)}</td>
                    <td>{t.quantity}</td><td>{t.returned_quantity}</td>
                    <td>{nameById(departments, t.transfer_from_department_id)}</td>
                    <td>{nameById(departments, t.transfer_to_department_id)}</td>
                    <td>{nameById(areas, t.transfer_to_area_id)}</td>
                    <td>{t.borrowed_by}</td>
                    <td>{formatDateTime(t.borrowed_at)}</td>
                    <td>{formatDateTime(t.expected_return_at)}</td>
                    <td><StatusBadge status={transferStatus(t)} /></td>
                  </tr>
                ))}
                {rows.length === 0 ? <EmptyRow colSpan={10} label="No transfers recorded" /> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
