-- Add missing Area tracking columns for transfers and returns
ALTER TABLE public.tool_transfers 
  ADD COLUMN transfer_to_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

ALTER TABLE public.tool_returns
  ADD COLUMN area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Add current location tracking to tools
ALTER TABLE public.tools
  ADD COLUMN current_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN current_area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;

-- Initialize current location to home location for existing tools
UPDATE public.tools SET current_department_id = department_id, current_area_id = area_id;
