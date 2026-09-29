import { createFileRoute } from "@tanstack/react-router";
import { NameListPage } from "@/components/name-list-page";
import { useDepartments } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Jhaymarts Tools Management System" },
      { name: "description", content: "Manage the Jhaymarts departments that own and borrow tools." },
      { property: "og:title", content: "Departments — Jhaymarts" },
      { property: "og:description", content: "Manage Jhaymarts departments." },
    ],
  }),
  component: () => {
    const { data = [] } = useDepartments();
    return <NameListPage title="Departments" singular="Department" table="departments" items={data} toolKey="department_id" />;
  },
});
