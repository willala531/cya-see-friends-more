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
            group_interests,
            last_suggested_activity_id,
            group_members (
              id,
              user_id,
              role,
              can_invite,
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
    staleTime: 60_000,
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
          group_interests,
          last_suggested_activity_id,
          group_members (
            id,
            user_id,
            role,
            can_invite,
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
    staleTime: 60_000,
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

      // Creator always gets can_invite = true so they can invite from the group page
      const { error: memberError } = await supabase
        .from("group_members")
        .insert({ group_id: group.id, user_id: user!.id, role: "admin", can_invite: true });

      if (memberError) throw memberError;
      return group;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

/**
 * Saves the group's selected activity IDs to Supabase.
 * Any group member can call this — the RLS policy must allow member updates.
 */
export function useUpdateGroupInterests() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      interestIds,
    }: {
      groupId: string;
      interestIds: string[];
    }) => {
      const { error } = await supabase
        .from("groups")
        .update({ group_interests: interestIds })
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}

/**
 * Persists the most recently suggested activity ID on the group row so the
 * repeat filter works across page reloads and sessions.
 */
export function useUpdateLastSuggested() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      activityId,
    }: {
      groupId: string;
      activityId: string;
    }) => {
      const { error } = await supabase
        .from("groups")
        .update({ last_suggested_activity_id: activityId })
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}

/**
 * Toggles can_invite on a group_members row.
 * Only the group creator (checked server-side via RLS) should call this.
 */
export function useUpdateCanInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      memberId,
      groupId,
      canInvite,
    }: {
      memberId: string;
      groupId: string;
      canInvite: boolean;
    }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ can_invite: canInvite })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
  });
}
