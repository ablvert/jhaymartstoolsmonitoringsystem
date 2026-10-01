-- Add released_by column to tool_transfers
ALTER TABLE public.tool_transfers
  ADD COLUMN IF NOT EXISTS released_by text;
