import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Area, Department, Profile, Tool, ToolReturn, Transfer } from "./domain";

async function selectAll<T>(table: string, order: string, ascending = true) {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => selectAll<Department>("departments", "name"),
  });
}

export function useAreas() {
  return useQuery({ queryKey: ["areas"], queryFn: () => selectAll<Area>("areas", "name") });
}

export function useTools() {
  return useQuery({ queryKey: ["tools"], queryFn: () => selectAll<Tool>("tools", "name") });
}

export function useTransfers() {
  return useQuery({
    queryKey: ["transfers"],
    queryFn: () => selectAll<Transfer>("tool_transfers", "borrowed_at", false),
  });
}

export function useReturns() {
  return useQuery({
    queryKey: ["returns"],
    queryFn: () => selectAll<ToolReturn>("tool_returns", "returned_at", false),
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => selectAll<Profile>("profiles", "created_at"),
  });
}

export function useActivityLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["activity_logs"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export function useRefreshAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["tools"] });
    void qc.invalidateQueries({ queryKey: ["transfers"] });
    void qc.invalidateQueries({ queryKey: ["returns"] });
    void qc.invalidateQueries({ queryKey: ["departments"] });
    void qc.invalidateQueries({ queryKey: ["areas"] });
    void qc.invalidateQueries({ queryKey: ["profiles"] });
  };
}

export function nameById<T extends { id: string; name: string }>(items: T[] | undefined, id: string | null) {
  if (!id) return "—";
  return items?.find((i) => i.id === id)?.name ?? "—";
}
