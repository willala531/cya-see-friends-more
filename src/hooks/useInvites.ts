import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbGroupInvite } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base URL for invite links. */
export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

// ─── Response types ───────────────────────────────────────────────────────────

export type CreateInviteResult =
  | { type: "existing_user"; message: string }
  | { type: "new_user"; token: string; inviteUrl: string; inviteId: string; warning?: string };

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * All pending invites for a group, with the sender's display_name.
 * Only shown to group members (enforced by RLS).
 */
export function useGroupInvites(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["invites", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_invites")
        .select(`
          *,
          users ( id, display_name )
        `)
        .eq("group_id", groupId!)
        .in("status", ["pending"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DbGroupInvite[];
    },
    enabled: !!user && !!groupId,
    staleTime: 30_000,
  });
}

/**
 * Checks whether the current user has a pending in-app invite for a specific group.
 * Returns the invite row (with inviter name + group name) or null.
 * Used by GroupPage to surface the InviteAcceptModal to existing users.
 */
export function useMyPendingGroupInvite(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-invite", groupId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_invites")
        .select(`
          *,
          inviter:users!group_invites_invited_by_fkey ( id, display_name ),
          groups ( id, name )
        `)
        .eq("group_id", groupId!)
        .eq("invited_user_id", user!.id)
        .eq("status", "pending")
        .maybeSingle();

      if (error) throw error;
      return data as DbGroupInvite | null;
    },
    enabled: !!user && !!groupId,
    staleTime: 30_000,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Sends an invite (or re-sends) by invoking the create-invite Edge Function.
 * Returns a typed result indicating whether the invitee is an existing user
 * (in-app notification) or a new user (SMS sent).
 */
export function useCreateInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      phoneNumber,
    }: {
      groupId: string;
      phoneNumber: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-invite", {
        body: {
          groupId,
          phoneNumber,
          invitedByUserId: user!.id,
        },
      });
      if (error) throw error;
      return data as CreateInviteResult;
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["invites", groupId] });
    },
  });
}

/**
 * Accepts or declines a token-based invite (for new users coming via the /invite/:token URL).
 * Invokes the process-invite Edge Function.
 */
export function useProcessInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      userId,
      type,
    }: {
      token: string;
      userId: string;
      type: "accept" | "decline";
    }) => {
      const { data, error } = await supabase.functions.invoke("process-invite", {
        body: { token, userId, type },
      });
      if (error) throw error;
      return data as { ok: boolean; groupId?: string; groupName?: string };
    },
    onSuccess: (data) => {
      if (data.groupId) {
        queryClient.invalidateQueries({ queryKey: ["group", data.groupId] });
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["invites", data.groupId] });
      }
    },
  });
}

/**
 * Accepts or declines an in-app invite for an existing cya user.
 * Uses the invite row's id (not token) — the Edge Function verifies invited_user_id matches.
 */
export function useRespondToDirectInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inviteId,
      groupId,
      type,
    }: {
      inviteId: string;
      groupId: string;
      type: "accept-direct" | "decline";
    }) => {
      const { data, error } = await supabase.functions.invoke("process-invite", {
        body: { inviteId, userId: user!.id, type },
      });
      if (error) throw error;
      return data as { ok: boolean; groupId?: string; groupName?: string };
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["invites", groupId] });
      queryClient.invalidateQueries({ queryKey: ["my-invite", groupId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });
}

/**
 * Saves the user's phone number and marks onboarding complete.
 * Called from OnboardingPage on save or skip.
 */
export function useCompleteOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phoneNumber }: { phoneNumber: string | null }) => {
      const { error } = await supabase
        .from("users")
        .update({
          phone_number: phoneNumber,
          has_completed_onboarding: true,
        })
        .eq("id", user!.id);
      if (error) throw error;

      // If phone number was provided, auto-join any pending invites for that number
      if (phoneNumber) {
        await supabase.functions.invoke("process-invite", {
          body: { phoneNumber, userId: user!.id, type: "phone-match" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
