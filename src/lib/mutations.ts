import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./auth";
import type { Tool, Transfer } from "./domain";

// Loosely typed handle for generic table writes.
export const db = supabase as any;

async function check<T>(p: Promise<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

export async function recordTransfer(input: {
  tool: Tool;
  quantity: number;
  fromId: string | null;
  toId: string;
  borrowedBy: string;
  borrowedAt: string;
  expectedReturnAt: string;
  description: string;
  reason: string;
}) {
  const { tool } = input;
  if (input.quantity < 1) throw new Error("Quantity must be at least 1");
  if (input.quantity > tool.available_quantity)
    throw new Error(`Only ${tool.available_quantity} unit(s) of ${tool.name} are available`);
  if (new Date(input.expectedReturnAt) <= new Date(input.borrowedAt))
    throw new Error("Expected return must be after the borrowed date");

  await check(
    db.from("tool_transfers").insert({
      tool_id: tool.id,
      quantity: input.quantity,
      returned_quantity: 0,
      transfer_from_department_id: input.fromId,
      transfer_to_department_id: input.toId,
      borrowed_by: input.borrowedBy.trim(),
      borrowed_at: new Date(input.borrowedAt).toISOString(),
      expected_return_at: new Date(input.expectedReturnAt).toISOString(),
      description: input.description || null,
      reason: input.reason || null,
      status: "Borrowed",
    }),
  );
  await check(
    db
      .from("tools")
      .update({ available_quantity: tool.available_quantity - input.quantity })
      .eq("id", tool.id),
  );
  await logActivity("Tool transfer", `${input.quantity} × ${tool.name} to ${input.borrowedBy}`);
}

export async function recordReturn(input: {
  transfer: Transfer;
  tool: Tool;
  quantity: number;
  returnedBy: string;
  receivedBy: string;
  returnedAt: string;
  condition: string;
  notes: string;
}) {
  const { transfer, tool } = input;
  const outstanding = transfer.quantity - transfer.returned_quantity;
  if (input.quantity < 1) throw new Error("Quantity must be at least 1");
  if (input.quantity > outstanding)
    throw new Error(`Only ${outstanding} unit(s) are still outstanding on this transfer`);

  const newReturned = transfer.returned_quantity + input.quantity;
  await check(
    db.from("tool_returns").insert({
      tool_id: tool.id,
      transfer_id: transfer.id,
      department_id: transfer.transfer_from_department_id,
      quantity: input.quantity,
      returned_by: input.returnedBy.trim(),
      received_by: input.receivedBy.trim(),
      returned_at: new Date(input.returnedAt).toISOString(),
      condition: input.condition,
      notes: input.notes || null,
    }),
  );
  await check(
    db
      .from("tool_transfers")
      .update({
        returned_quantity: newReturned,
        status: newReturned >= transfer.quantity ? "Returned" : "Partially Returned",
      })
      .eq("id", transfer.id),
  );
  await check(
    db
      .from("tools")
      .update({
        available_quantity: Math.min(tool.quantity, tool.available_quantity + input.quantity),
        needs_repair: tool.needs_repair || input.condition !== "Good",
      })
      .eq("id", tool.id),
  );
  await logActivity("Tool return", `${input.quantity} × ${tool.name} by ${input.returnedBy}`);
}
