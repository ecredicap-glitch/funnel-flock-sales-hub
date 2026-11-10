import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export type Membership = {
  role: MemberRole;
  workspace: { id: string; name: string; timezone: string };
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  admin: "Admin",
  operator: "Operador",
};

export const membershipsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["memberships", userId],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("role, workspace:workspaces(id, name, timezone)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.workspace)
        .map((m) => ({ role: m.role, workspace: m.workspace! }));
    },
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

const STORAGE_KEY = "zappilot-workspace";

type WorkspaceContextValue = {
  userId: string;
  memberships: Membership[];
  current: Membership | null;
  setCurrentId: (id: string) => void;
  isAdmin: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const { data: memberships } = useSuspenseQuery(membershipsQuery(userId));
  const [currentId, setCurrentIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCurrentIdState(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const current = useMemo(
    () => memberships.find((m) => m.workspace.id === currentId) ?? memberships[0] ?? null,
    [memberships, currentId],
  );

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{ userId, memberships, current, setCurrentId, isAdmin: current?.role === "admin" }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
