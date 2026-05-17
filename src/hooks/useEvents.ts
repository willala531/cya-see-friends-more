import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbHangoutSuggestion, DbHangoutVote } from "@/types/database";

// ─── Query key constants ───────────────────────────────────────────────────────
// Centralising key shapes here so invalidation is always consistent and never
// accidentally blasts unrelated queries (which caused 5-6x duplicate requests).

export const eventKeys = {
  all:   (userId: string) => ["events", userId] as const,
  group: (groupId: string) => ["events", "group", groupId] as const,
  votes: (hangoutId: string) => ["votes", hangoutId] as const,
};

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * All hangout suggestions (across every group the user belongs to),
 * ordered chronologically, with group name and RSVPs nested.
 */
export function useEvents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: eventKeys.all(user?.id ?? ""),
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("hangout_suggestions")
        .select(`
          *,
          groups ( id, name ),
          rsvps (
            id, user_id, response,
            users ( id, display_name )
          )
        `)
        .gt("start_time", now)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DbHangoutSuggestion[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

/** Hangout suggestions for a single group, with RSVPs nested. */
export function useGroupEvents(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: eventKeys.group(groupId ?? ""),
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("hangout_suggestions")
        .select(`
          *,
          rsvps (
            id, user_id, response,
            users ( id, display_name )
          )
        `)
        .eq("group_id", groupId!)
        .gt("start_time", now)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DbHangoutSuggestion[];
    },
    enabled: !!user && !!groupId,
    // Realtime in useRsvpDecision invalidates this key on every RSVP change,
    // so live updates still work even with a 30-second staleTime.
    staleTime: 30_000,
  });
}

/** Votes for a single hangout (used during the vote flow). */
export function useHangoutVotes(hangoutId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: eventKeys.votes(hangoutId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hangout_votes")
        .select("*")
        .eq("hangout_id", hangoutId!);
      if (error) throw error;
      return (data ?? []) as DbHangoutVote[];
    },
    enabled: !!user && !!hangoutId,
    staleTime: 15_000,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert the current user's RSVP for a hangout.
 * Requires groupId so we can invalidate only the relevant queries instead of
 * blasting every events-* key (which caused duplicate refetches on Dashboard).
 */
export function useUpdateRsvp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hangoutId,
      groupId,
      response,
    }: {
      hangoutId: string;
      groupId: string;
      response: "yes" | "no" | "maybe" | "pending";
    }) => {
      const { error } = await supabase.from("rsvps").upsert(
        { hangout_id: hangoutId, user_id: user!.id, response },
        { onConflict: "hangout_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      // Only invalidate the specific group's events + the dashboard list.
      queryClient.invalidateQueries({ queryKey: eventKeys.group(groupId) });
      queryClient.invalidateQueries({ queryKey: ["events", user?.id] });
    },
  });
}

/**
 * Creates a new hangout suggestion via the create-suggestion Edge Function.
 *
 * The Edge Function enforces rate-limiting before inserting:
 *   - 7-day cooldown since last confirmed hangout for this group
 *   - 48-hour retry cooldown after a cancelled/expired suggestion
 *   - Guard against duplicate pending/paused suggestions
 *
 * Returns the new suggestion on success, or null when rate-limited (ok: false).
 * A null return is a silent no-op — the caller should not treat it as an error.
 */
export function useCreateHangoutSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestion: {
      group_id: string;
      suggested_activity: string;
      start_time: string;
      end_time: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("create-suggestion", {
        body: {
          groupId: suggestion.group_id,
          suggestedActivity: suggestion.suggested_activity,
          startTime: suggestion.start_time,
          endTime: suggestion.end_time,
        },
      });

      if (error) throw error;

      // ok: false means rate-limited — treat as silent no-op, not an error
      if (!data?.ok) return null;

      return data.suggestion as DbHangoutSuggestion;
    },
    onSuccess: (_data, { group_id }) => {
      queryClient.invalidateQueries({ queryKey: ["events", "group", group_id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/** Update the status of a hangout suggestion. */
export function useUpdateHangoutStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hangoutId,
      groupId,
      status,
    }: {
      hangoutId: string;
      groupId: string;
      status: "pending" | "confirmed" | "cancelled" | "expired" | "paused" | "completed";
    }) => {
      const { error } = await supabase
        .from("hangout_suggestions")
        .update({ status })
        .eq("id", hangoutId);
      if (error) throw error;
    },
    onSuccess: (_data, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.group(groupId) });
    },
  });
}

/** Cast or change the current user's vote on an activity for a hangout. */
export function useCastVote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hangoutId,
      activityId,
    }: {
      hangoutId: string;
      activityId: string;
    }) => {
      const { error } = await supabase.from("hangout_votes").upsert(
        { hangout_id: hangoutId, user_id: user!.id, activity_id: activityId },
        { onConflict: "hangout_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { hangoutId }) => {
      queryClient.invalidateQueries({ queryKey: ["votes", hangoutId] });
    },
  });
}
