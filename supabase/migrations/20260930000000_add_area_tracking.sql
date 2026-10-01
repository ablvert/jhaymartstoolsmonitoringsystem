-- Safe idempotent migration: add area tracking columns
-- Can be run multiple times without error

-- Add transfer_to_area_id to track which physical area the tool went to
ALTER TABLE public.tool_transfers
  ADD COLUMN IF NOT EXISTS transfer_to_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Add area_id to tool_returns to track which physical area the tool was returned to
ALTER TABLE public.tool_returns
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Add current location tracking to tools (separate from home department_id)
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS current_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS current_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Initialize current location from home location for all existing tools
UPDATE public.tools
SET current_department_id = department_id,
    current_area_id = area_id
WHERE current_department_id IS NULL;
