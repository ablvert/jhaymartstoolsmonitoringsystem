import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import logo from "@/assets/jhaymarts-logo.png";
import { Button, EmptyRow, PageHeader, Panel } from "@/components/ui";
import { nameById, useAreas, useDepartments, useReturns, useTools, useTransfers } from "@/lib/data";
import { toolStatus, transferStatus } from "@/lib/domain";
import { formatDateTime, formatMoney } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Jhaymarts Tools Management System" },
      { name: "description", content: "Preview and export inventory, transfer and return reports to Excel." },
      { property: "og:title", content: "Reports — Jhaymarts" },
      { property: "og:description", content: "Inventory, transfer and return reports." },
    ],
  }),
  component: Reports,
});

type Kind = "inventory" | "transfers" | "returns";

function Reports() {
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: returns = [] } = useReturns();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();
  const [kind, setKind] = useState<Kind>("inventory");

  const rows = useMemo<Record<string, string | number>[]>(() => {
    const tn = (id: string) => nameById(tools as any, id);
    if (kind === "inventory")
      return tools.map((t) => ({
        "Tool name": t.name, Quantity: t.quantity, Available: t.available_quantity,
        "Unit cost": formatMoney(Number(t.unit_cost)), "Total value": formatMoney(Number(t.unit_cost) * t.quantity),
        Department: nameById(departments, t.department_id), Area: nameById(areas, t.area_id), Status: toolStatus(t, transfers),
      }));
    if (kind === "transfers")
      return transfers.map((t) => ({
        Tool: tn(t.tool_id), Quantity: t.quantity, Returned: t.returned_quantity,
        From: nameById(departments, t.transfer_from_department_id), To: nameById(departments, t.transfer_to_department_id),
        "Borrowed by": t.borrowed_by, Borrowed: formatDateTime(t.borrowed_at),
        "Expected return": formatDateTime(t.expected_return_at), Status: transferStatus(t),
      }));
    return returns.map((r) => ({
      Tool: tn(r.tool_id), Quantity: r.quantity, "Returned to": nameById(departments, r.department_id),
      "Returned by": r.returned_by, Date: formatDateTime(r.returned_at), Condition: r.condition, Notes: r.notes ?? "",
    }));
  }, [kind, tools, transfers, returns, departments, areas]);

  const titles: Record<Kind, string> = { inventory: "Tools inventory report", transfers: "Tool transfer report", returns: "Tool return report" };
  const headers = Object.keys(rows[0] ?? {});

  return (
    <div>
      <PageHeader
        title="Reports"
        breadcrumb="Home / Reports"
        actions={<Button onClick={() => exportToExcel(rows, titles[kind], `jhaymarts-${kind}-report`)}><Download size={14} /> Export to Excel</Button>}
      />
      <div className="mb-[10px] flex gap-[6px]" role="tablist">
        {(Object.keys(titles) as Kind[]).map((k) => (
          <Button key={k} role="tab" aria-selected={kind === k} variant={kind === k ? "primary" : "secondary"} onClick={() => setKind(k)}>
            {titles[k]}
          </Button>
        ))}
      </div>
      <Panel>
        <div className="flex items-center gap-[10px] border-b border-border p-[12px]">
          <img src={logo} alt="Jhaymarts logo" width={512} height={512} className="h-[40px] w-[40px] object-contain" />
          <div>
            <div className="text-[12px] text-muted-foreground">JHAYMARTS INDUSTRIES, INC.</div>
            <div className="text-[15px] font-medium">{titles[kind]}</div>
            <div className="text-[12px] text-muted-foreground">Generated {formatDateTime(new Date().toISOString())} · {rows.length} record(s)</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{headers.map((h) => <td key={h}>{r[h]}</td>)}</tr>)}
              {rows.length === 0 ? <EmptyRow colSpan={Math.max(headers.length, 1)} label="No records for this report" /> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
