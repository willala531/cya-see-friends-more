import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbGroupWithMembers } from "@/types/database";

// ─── Read ─────────────────────────────────────────────────────────────────────

/** All groups the current user belongs to, with members nested. */
export function useGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["groups", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select(`
          group_id,
          groups (
            id,
            name,
            invite_code,
            created_by,
            created_at,
            group_members (
              id,
              user_id,
              role,
              joined_at,
              users ( id, display_name, email )
            )
          )
        `)
        .eq("user_id", user!.id);

      if (error) throw error;
      return (data?.map((row) => row.groups).filter(Boolean) ?? []) as DbGroupWithMembers[];
    },
    enabled: !!user,
  });
}

/** A single group by ID, with members nested. */
export function useGroup(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select(`
          id,
          name,
          invite_code,
          created_by,
          created_at,
          group_members (
            id,
            user_id,
            role,
            joined_at,
            users ( id, display_name, email )
          )
        `)
        .eq("id", groupId!)
        .single();

      if (error) throw error;
      return data as DbGroupWithMembers;
    },
    enabled: !!user && !!groupId,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Creates a new group and adds the current user as admin in one transaction.
 * Returns the newly created group row.
 */
export function useCreateGroup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({ name, created_by: user!.id })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: user!.id, role: "admin" });

      if (memberError) throw memberError;
      return group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}
