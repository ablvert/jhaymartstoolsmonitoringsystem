import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, Panel, PanelHeader, EmptyRow, StatusBadge } from "@/components/ui";
import { nameById, useAreas, useDepartments, useReturns, useTools, useTransfers } from "@/lib/data";
import { isOverdue, toolStatus } from "@/lib/domain";
import { useAuth } from "@/lib/auth";
import { durationSince, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Jhaymarts Tools Management System" },
      {
        name: "description",
        content: "Live tools, borrowings, returns and overdue totals across every Jhaymarts area.",
      },
      { property: "og:title", content: "Dashboard — Jhaymarts Tools" },
      { property: "og:description", content: "Live tools, borrowings, returns and overdue totals." },
    ],
  }),
  component: Dashboard,
});

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Good Morning";
  if (h >= 12 && h < 18) return "Good Afternoon";
  return "Good Evening";
}

function Dashboard() {
  const { profile } = useAuth();
  const { data: tools = [] } = useTools();
  const { data: transfers = [] } = useTransfers();
  const { data: returns = [] } = useReturns();
  const { data: departments = [] } = useDepartments();
  const { data: areas = [] } = useAreas();

  const stats = useMemo(() => {
    const totalQty = tools.reduce((s, t) => s + t.quantity, 0);
    const available = tools.reduce((s, t) => s + t.available_quantity, 0);
    const borrowed = transfers
      .filter((t) => t.quantity - t.returned_quantity > 0)
      .reduce((s, t) => s + (t.quantity - t.returned_quantity), 0);
    const overdue = transfers.filter((t) => isOverdue(t));
    return {
      totalTools: tools.length,
      totalQty,
      available,
      borrowed,
      overdue: overdue.length,
      needsRepair: tools.filter((t) => t.needs_repair).length,
      value: tools.reduce((s, t) => s + Number(t.unit_cost) * t.quantity, 0),
    };
  }, [tools, transfers]);

  const overdueList = transfers.filter((t) => isOverdue(t));

  const cards = [
    { label: "Total tools", value: stats.totalTools, to: "/inventory", search: {} as any, tone: "text-foreground" },
    { label: "Available", value: stats.available, to: "/inventory", search: { status: "Available" }, tone: "text-success" },
    { label: "Borrowed", value: stats.borrowed, to: "/transfer", search: {}, tone: "text-info" },
    { label: "Overdue", value: stats.overdue, to: "/overdue", search: {}, tone: "text-danger" },
    { label: "Needs repair", value: stats.needsRepair, to: "/inventory", search: { status: "Needs Repair" }, tone: "text-warning" },
    { label: "Departments", value: departments.length, to: "/departments", search: {}, tone: "text-foreground" },
    { label: "Locations", value: areas.length, to: "/areas", search: {}, tone: "text-foreground" },
  ] as const;

  return (
    <div>
      <div className="mb-[14px]">
        <h2 className="text-[26px] font-medium text-foreground">
          {greeting()} {profile?.full_name || profile?.username || ""}
        </h2>
        <p className="text-[13px] text-muted-foreground">Welcome back to Jhaymarts Tools Management System.</p>
      </div>
      <PageHeader
        title="Dashboard"
        breadcrumb="Home / Dashboard"
        description={`Total inventory value ₱${formatMoney(stats.value)} across ${stats.totalQty} units.`}
      />

      <div className="mb-[14px] grid grid-cols-2 gap-[10px] md:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            search={c.search as never}
            className="panel px-[12px] py-[10px] transition-colors hover:border-primary"
          >
            <div className="text-[11px] tracking-wide text-muted-foreground uppercase">{c.label}</div>
            <div className={`mt-[2px] text-[24px] font-medium ${c.tone}`}>{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Tools by area" />
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Tools</th>
                <th scope="col">Units</th>
                <th scope="col">Available</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => {
                const list = tools.filter((t) => t.area_id === a.id);
                return (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td>{list.length}</td>
                    <td>{list.reduce((s, t) => s + t.quantity, 0)}</td>
                    <td>{list.reduce((s, t) => s + t.available_quantity, 0)}</td>
                  </tr>
                );
              })}
              {areas.length === 0 ? <EmptyRow colSpan={4} label="No areas yet" /> : null}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader title="Tools by department" />
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Department</th>
                <th scope="col">Tools</th>
                <th scope="col">Units</th>
                <th scope="col">Available</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const list = tools.filter((t) => t.department_id === d.id);
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td>{list.length}</td>
                    <td>{list.reduce((s, t) => s + t.quantity, 0)}</td>
                    <td>{list.reduce((s, t) => s + t.available_quantity, 0)}</td>
                  </tr>
                );
              })}
              {departments.length === 0 ? <EmptyRow colSpan={4} label="No departments yet" /> : null}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <PanelHeader title="Recent tool transfers" />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Qty</th>
                  <th scope="col">To</th>
                  <th scope="col">Borrowed by</th>
                  <th scope="col">Released by</th>
                  <th scope="col">Date &amp; time</th>
                </tr>
              </thead>
              <tbody>
                {transfers.slice(0, 6).map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{nameById(tools as any, t.tool_id)}</td>
                    <td>{t.quantity}</td>
                    <td>{nameById(departments, t.transfer_to_department_id)}</td>
                    <td>{t.borrowed_by}</td>
                    <td>{t.released_by}</td>
                    <td>{formatDateTime(t.borrowed_at)}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? <EmptyRow colSpan={6} label="No transfers recorded" /> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recent tool returns" />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Returned by</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Date &amp; time</th>
                </tr>
              </thead>
              <tbody>
                {returns.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{nameById(tools as any, r.tool_id)}</td>
                    <td>{r.quantity}</td>
                    <td>{r.returned_by}</td>
                    <td>
                      <StatusBadge status={r.condition} />
                    </td>
                    <td>{formatDateTime(r.returned_at)}</td>
                  </tr>
                ))}
                {returns.length === 0 ? <EmptyRow colSpan={5} label="No returns recorded" /> : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Overdue tools"
            actions={
              <Link to="/overdue" className="text-[12px] text-link underline-offset-2 hover:underline">
                View all
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Borrowed by</th>
                  <th scope="col">Released by</th>
                  <th scope="col">Original department</th>
                  <th scope="col">Current department</th>
                  <th scope="col">Expected return</th>
                  <th scope="col">Overdue by</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{nameById(tools as any, t.tool_id)}</td>
                    <td>{t.quantity - t.returned_quantity}</td>
                    <td>{t.borrowed_by}</td>
                    <td>{t.released_by}</td>
                    <td className="font-medium text-danger">
                      {nameById(departments, t.transfer_from_department_id)}
                    </td>
                    <td>{nameById(departments, t.transfer_to_department_id)}</td>
                    <td>{formatDateTime(t.expected_return_at)}</td>
                    <td>{durationSince(t.expected_return_at)}</td>
                  </tr>
                ))}
                {overdueList.length === 0 ? (
                  <EmptyRow colSpan={8} label="No overdue tools. Everything is on schedule." />
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <p className="mt-[14px] text-[12px] text-muted-foreground">
        Status of each tool is calculated live:{" "}
        {tools.slice(0, 3).map((t) => `${t.name} — ${toolStatus(t, transfers)}`).join(" · ")}
      </p>
    </div>
  );
}
