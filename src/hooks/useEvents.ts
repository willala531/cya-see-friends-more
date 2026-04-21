import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbHangoutSuggestion } from "@/types/database";

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * All hangout suggestions (across every group the user belongs to),
 * ordered chronologically, with group name and RSVPs nested.
 */
export function useEvents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["events", user?.id],
    queryFn: async () => {
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
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DbHangoutSuggestion[];
    },
    enabled: !!user,
  });
}

/** Hangout suggestions for a single group, with RSVPs nested. */
export function useGroupEvents(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["events", "group", groupId],
    queryFn: async () => {
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
        .order("start_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as DbHangoutSuggestion[];
    },
    enabled: !!user && !!groupId,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Upsert the current user's RSVP for a hangout.
 * Conflicts on (hangout_id, user_id) are updated in place.
 */
export function useUpdateRsvp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      hangoutId,
      response,
    }: {
      hangoutId: string;
      response: "yes" | "no" | "pending";
    }) => {
      const { error } = await supabase.from("rsvps").upsert(
        { hangout_id: hangoutId, user_id: user!.id, response },
        { onConflict: "hangout_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

/**
 * Inserts a new hangout suggestion (status: pending) for a group.
 * Called automatically by GroupPage when a new activity is suggested.
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
      const { data, error } = await supabase
        .from("hangout_suggestions")
        .insert({ ...suggestion, status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { group_id }) => {
      queryClient.invalidateQueries({ queryKey: ["events", "group", group_id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
