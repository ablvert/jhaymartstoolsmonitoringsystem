import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyRow, Field, Input, Modal, PageHeader, Panel } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useRefreshAll, useTools } from "@/lib/data";
import { db } from "@/lib/mutations";
import { logActivity } from "@/lib/auth";
import type { Tool } from "@/lib/domain";

/** Shared CRUD page for simple name lists (departments, areas). */
export function NameListPage({
  title,
  singular,
  table,
  items,
  toolKey,
}: {
  title: string;
  singular: string;
  table: "departments" | "areas";
  items: { id: string; name: string }[];
  toolKey: keyof Pick<Tool, "department_id" | "area_id">;
}) {
  const { data: tools = [] } = useTools();
  const refresh = useRefreshAll();
  const { notify } = useToast();
  const [edit, setEdit] = useState<{ id?: string; name: string } | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);

  async function save() {
    if (!edit?.name.trim()) return notify(`${singular} name is required`, "error");
    const name = edit.name.trim();
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase() && i.id !== edit.id))
      return notify(`${singular} "${name}" already exists`, "error");
    const { error } = edit.id
      ? await db.from(table).update({ name }).eq("id", edit.id)
      : await db.from(table).insert({ name });
    if (error) return notify(error.message, "error");
    await logActivity(`${edit.id ? "Edit" : "Add"} ${singular.toLowerCase()}`, name);
    notify(`${singular} saved`);
    setEdit(null);
    refresh();
  }

  async function remove() {
    if (!del) return;
    const used = tools.filter((t) => t[toolKey] === del.id).length;
    if (used) return notify(`Cannot delete: ${used} tool(s) are assigned to ${del.name}`, "error");
    const { error } = await db.from(table).delete().eq("id", del.id);
    if (error) return notify(error.message, "error");
    await logActivity(`Delete ${singular.toLowerCase()}`, del.name);
    notify(`${singular} deleted`);
    setDel(null);
    refresh();
  }

  return (
    <div className="max-w-[760px]">
      <PageHeader
        title={title}
        breadcrumb={`Home / ${title}`}
        actions={<Button onClick={() => setEdit({ name: "" })}><Plus size={14} /> Add {singular.toLowerCase()}</Button>}
      />
      <Panel>
        <table className="data-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Tools</th><th scope="col">Units</th><th scope="col" className="text-right">Actions</th></tr></thead>
          <tbody>
            {items.map((i) => {
              const list = tools.filter((t) => t[toolKey] === i.id);
              return (
                <tr key={i.id}>
                  <td className="font-medium">{i.name}</td>
                  <td>{list.length}</td>
                  <td>{list.reduce((s, t) => s + t.quantity, 0)}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" aria-label={`Edit ${i.name}`} onClick={() => setEdit({ id: i.id, name: i.name })}><Pencil size={14} /></Button>
                    <Button variant="ghost" aria-label={`Delete ${i.name}`} onClick={() => setDel(i)}><Trash2 size={14} className="text-danger" /></Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? <EmptyRow colSpan={4} label={`No ${title.toLowerCase()} yet`} /> : null}
          </tbody>
        </table>
      </Panel>
      <Modal open={!!edit} title={edit?.id ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`} onClose={() => setEdit(null)}>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex flex-col gap-[12px]">
          <Field label="Name" required>
            <Input autoFocus value={edit?.name ?? ""} onChange={(e) => setEdit((p) => (p ? { ...p, name: e.target.value } : p))} />
          </Field>
          <div className="flex justify-end gap-[6px]">
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!del} title={`Delete ${singular.toLowerCase()}`} onClose={() => setDel(null)}>
        <p className="text-[13px]">Delete <strong>{del?.name}</strong>? This cannot be undone.</p>
        <div className="mt-[14px] flex justify-end gap-[6px]">
          <Button variant="secondary" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => void remove()}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
