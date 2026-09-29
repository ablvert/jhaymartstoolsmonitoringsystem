import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyRow, Field, Input, PageHeader, Panel, Select, StatusBadge } from "@/components/ui";
import { nameById, useAreas, useDepartments, useTools, useTransfers } from "@/lib/data";
import { toolStatus } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({
    meta: [
      { title: "Search tools — Jhaymarts Tools Management System" },
      { name: "description", content: "Find any Jhaymarts tool by name, department, area or status." },
      { property: "og:title", content: "Search tools — Jhaymarts" },
      { property: "og:description", content: "Find any Jhaymarts tool." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const initial = Route.useSearch();
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();
  const [q, setQ] = useState(initial.q ?? "");
  const [dept, setDept] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(() => tools
    .map((t) => ({ t, s: toolStatus(t, transfers) }))
    .filter(({ t, s }) =>
      (!q || `${t.name} ${t.description ?? ""} ${t.supplier ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!dept || t.department_id === dept) && (!area || t.area_id === area) && (!status || s === status)),
  [tools, transfers, q, dept, area, status]);

  return (
    <div>
      <PageHeader title="Search tools" breadcrumb="Home / Search tools" />
      <Panel className="mb-[14px] p-[12px]">
        <div className="grid gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Keyword"><Input autoFocus placeholder="Tool name, description, supplier" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Department">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Area">
            <Select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">All areas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {["Available", "Partially Borrowed", "Fully Borrowed", "Overdue", "Needs Repair"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Panel>
      <Panel>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th scope="col">Tool</th><th scope="col">Qty</th><th scope="col">Available</th><th scope="col">Department</th><th scope="col">Area</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map(({ t, s }) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td><td>{t.quantity}</td><td>{t.available_quantity}</td>
                  <td>{nameById(departments, t.department_id)}</td><td>{nameById(areas, t.area_id)}</td>
                  <td><StatusBadge status={s} /></td>
                </tr>
              ))}
              {rows.length === 0 ? <EmptyRow colSpan={6} label="No tools match your search" /> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
