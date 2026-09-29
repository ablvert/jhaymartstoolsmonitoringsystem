import { createFileRoute } from "@tanstack/react-router";
import { NameListPage } from "@/components/name-list-page";
import { useAreas } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/areas")({
  head: () => ({
    meta: [
      { title: "Areas — Jhaymarts Tools Management System" },
      { name: "description", content: "Manage the Jhaymarts locations where tools are kept." },
      { property: "og:title", content: "Areas — Jhaymarts" },
      { property: "og:description", content: "Manage Jhaymarts tool locations." },
    ],
  }),
  component: () => {
    const { data = [] } = useAreas();
    return <NameListPage title="Areas" singular="Area" table="areas" items={data} toolKey="area_id" />;
  },
});
