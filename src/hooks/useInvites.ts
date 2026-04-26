import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbGroupInvite } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base URL for invite links — swapped for production domain in Phase B. */
export function buildInviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * All pending (and recent) invites for a group, with the sender's display_name.
 * Only shown to group members (enforced by RLS).
 * Filters out expired and declined rows so the UI stays clean.
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

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Sends an invite (or re-sends if a pending invite already exists for this
 * phone number in this group) by invoking the create-invite Edge Function.
 * Returns { token, inviteUrl } on success.
 *
 * Phase B: the Edge Function will also send an SMS via Twilio.
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
      return data as { token: string; inviteUrl: string; inviteId: string };
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ["invites", groupId] });
    },
  });
}

/**
 * Accepts or declines an invite by token.
 * Invokes the process-invite Edge Function which uses service_role to
 * insert the group_member row and update the invite status.
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
      // Invalidate profile so PostAuthHandler re-reads has_completed_onboarding
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
