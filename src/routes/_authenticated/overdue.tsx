import { createFileRoute, Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button, EmptyRow, PageHeader, Panel } from "@/components/ui";
import { nameById, useDepartments, useTools, useTransfers } from "@/lib/data";
import { isOverdue } from "@/lib/domain";
import { durationSince, formatDateTime } from "@/lib/format";
import { exportToExcel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/overdue")({
  head: () => ({
    meta: [
      { title: "Overdue tools — Jhaymarts Tools Management System" },
      { name: "description", content: "Tools past their expected return and where they must go back." },
      { property: "og:title", content: "Overdue tools — Jhaymarts" },
      { property: "og:description", content: "Tools past their expected return date." },
    ],
  }),
  component: Overdue,
});

function Overdue() {
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: departments = [] } = useDepartments();
  const rows = transfers.filter((t) => isOverdue(t));

  return (
    <div>
      <PageHeader
        title="Overdue tools"
        breadcrumb="Home / Overdue tools"
        description={`${rows.length} transfer(s) past the expected return date.`}
        actions={
          <Button variant="secondary" onClick={() => exportToExcel(rows.map((t) => ({
            Tool: nameById(tools as any, t.tool_id), Quantity: t.quantity - t.returned_quantity,
            "Borrowed by": t.borrowed_by, "Current department": nameById(departments, t.transfer_to_department_id),
            "Original department": nameById(departments, t.transfer_from_department_id),
            "Expected return": formatDateTime(t.expected_return_at), "Overdue by": durationSince(t.expected_return_at),
          })), "Overdue tools", "jhaymarts-overdue-tools")}>
            <Download size={14} /> Export to Excel
          </Button>
        }
      />
      <Panel>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th scope="col">Tool</th><th scope="col">Qty</th><th scope="col">Borrowed by</th><th scope="col">Current department</th><th scope="col">Return instruction</th><th scope="col">Expected return</th><th scope="col">Overdue by</th><th scope="col"></th></tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{nameById(tools as any, t.tool_id)}</td>
                  <td>{t.quantity - t.returned_quantity}</td>
                  <td>{t.borrowed_by}</td>
                  <td>{nameById(departments, t.transfer_to_department_id)}</td>
                  <td className="font-medium text-danger">
                    RETURN TO ORIGINAL DEPARTMENT: {nameById(departments, t.transfer_from_department_id).toUpperCase()}
                  </td>
                  <td>{formatDateTime(t.expected_return_at)}</td>
                  <td>{durationSince(t.expected_return_at)}</td>
                  <td><Link to="/returns" className="text-link hover:underline">Record return</Link></td>
                </tr>
              ))}
              {rows.length === 0 ? <EmptyRow colSpan={8} label="No overdue tools. Everything is on schedule." /> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
