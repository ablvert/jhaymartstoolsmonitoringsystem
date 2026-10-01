export type Department = { id: string; name: string; created_at: string };
export type Area = { id: string; name: string; created_at: string };

export type Tool = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  available_quantity: number;
  unit_cost: number;
  department_id: string | null;
  area_id: string | null;
  current_department_id: string | null;
  current_area_id: string | null;
  date_purchased: string | null;
  supplier: string | null;
  needs_repair: boolean;
  created_at: string;
};

export type Transfer = {
  id: string;
  tool_id: string;
  quantity: number;
  returned_quantity: number;
  transfer_from_department_id: string | null;
  transfer_to_department_id: string | null;
  transfer_to_area_id: string | null;
  borrowed_by: string;
  released_by: string | null;
  borrowed_at: string;
  expected_return_at: string;
  description: string | null;
  reason: string | null;
  status: string;
};

export type ToolReturn = {
  id: string;
  tool_id: string;
  transfer_id: string | null;
  department_id: string | null;
  area_id: string | null;
  quantity: number;
  returned_by: string;
  received_by: string;
  returned_at: string;
  condition: string;
  notes: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  username: string;
  role: "admin" | "user";
  status: string;
  must_change_password: boolean;
  last_login: string | null;
  created_at: string;
};

export type ToolStatus =
  | "Available"
  | "Partially Borrowed"
  | "Fully Borrowed"
  | "Overdue"
  | "Needs Repair";

export function isOverdue(t: Transfer, now = Date.now()) {
  return t.quantity - t.returned_quantity > 0 && new Date(t.expected_return_at).getTime() < now;
}

export function transferStatus(t: Transfer): string {
  if (t.returned_quantity >= t.quantity) return "Returned";
  if (isOverdue(t)) return "Overdue";
  return t.returned_quantity > 0 ? "Partially Returned" : "Borrowed";
}

export function toolStatus(tool: Tool, transfers: Transfer[]): ToolStatus {
  const own = transfers.filter((t) => t.tool_id === tool.id);
  if (own.some((t) => isOverdue(t))) return "Overdue";
  if (tool.needs_repair) return "Needs Repair";
  if (tool.available_quantity <= 0 && tool.quantity > 0) return "Fully Borrowed";
  if (tool.available_quantity < tool.quantity) return "Partially Borrowed";
  return "Available";
}

export const AREA_FALLBACK = "—";
