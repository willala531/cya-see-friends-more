import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { DbAvailabilityBlock } from "@/types/database";
import type { BusyInterval, RecurringBlock } from "@/types/calendar";

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * All availability blocks for a given user.
 * Defaults to the current user when no userId is provided.
 */
export function useAvailabilityBlocks(userId?: string) {
  const { user } = useAuth();
  const targetId = userId ?? user?.id;

  return useQuery({
    queryKey: ["availability", targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("*")
        .eq("user_id", targetId!);

      if (error) throw error;
      return (data ?? []) as DbAvailabilityBlock[];
    },
    enabled: !!targetId,
    // Availability data changes rarely; 5-minute staleTime means GoogleCalendarContext
    // (always mounted) and AvailabilityPage share the same cached fetch.
    staleTime: 5 * 60_000,
  });
}

/**
 * All availability blocks for every member in a group.
 * Used by GroupPage to power the nearest-slot calculation across the whole group.
 * Requires the RLS policy that allows group members to read each other's blocks.
 */
export function useGroupAvailabilityBlocks(groupId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["availability", "group", groupId],
    queryFn: async () => {
      // Step 1: resolve member user IDs for this group
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId!);

      if (membersError) throw membersError;

      const userIds = members?.map((m) => m.user_id) ?? [];
      if (userIds.length === 0) return [] as DbAvailabilityBlock[];

      // Step 2: fetch all blocks for those users in one query
      const { data, error } = await supabase
        .from("availability_blocks")
        .select("*")
        .in("user_id", userIds);

      if (error) throw error;
      return (data ?? []) as DbAvailabilityBlock[];
    },
    enabled: !!user && !!groupId,
    // 2-minute staleTime: group availability rarely changes mid-session.
    // Mutations (upsertGoogleBlocks, upsertWeekSchedule) call invalidateQueries
    // to force a refresh when data actually changes.
    staleTime: 2 * 60_000,
  });
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Replaces all Google Calendar blocks for the current user with a fresh set.
 * Called after every syncCalendar() in GoogleCalendarContext.
 */
export function useUpsertGoogleBlocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (intervals: BusyInterval[]) => {
      // Delete stale google blocks first
      await supabase
        .from("availability_blocks")
        .delete()
        .eq("user_id", user!.id)
        .eq("source", "google");

      if (intervals.length === 0) return;

      const { error } = await supabase.from("availability_blocks").insert(
        intervals.map((b) => ({
          user_id: user!.id,
          start_time: b.start,
          end_time: b.end,
          is_recurring: false,
          source: "google",
        })),
      );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] }),
  });
}

/**
 * Adds a single manual recurring busy block for the current user.
 * The RecurringBlock (sans id) is stored as JSONB in recurrence_rule;
 * the DB row ID becomes the block's id when loaded back.
 */
export function useAddManualBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (block: Omit<RecurringBlock, "id">) => {
      const { error } = await supabase.from("availability_blocks").insert({
        user_id: user!.id,
        is_recurring: true,
        source: "manual",
        recurrence_rule: block as unknown as Record<string, unknown>,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] }),
  });
}

/**
 * Deletes any availability block by its DB row ID.
 * Used to remove manual recurring blocks and to clear all google blocks.
 */
export function useRemoveAvailabilityBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase
        .from("availability_blocks")
        .delete()
        .eq("id", blockId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] }),
  });
}

/**
 * Saves the weekly availability schedule (from AvailabilityPage) to Supabase.
 * Replaces the previous schedule block — there is always at most one per user.
 */
export function useUpsertWeekSchedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedule: Record<string, unknown>) => {
      // Remove the old schedule block first
      await supabase
        .from("availability_blocks")
        .delete()
        .eq("user_id", user!.id)
        .eq("source", "schedule");

      const { error } = await supabase.from("availability_blocks").insert({
        user_id: user!.id,
        is_recurring: true,
        source: "schedule",
        recurrence_rule: schedule,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["availability", user?.id] }),
  });
}
