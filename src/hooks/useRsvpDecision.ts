import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { activityByName } from "@/data/activities";
import { suggestAlternatives } from "@/utils/suggestionEngine";
import type { DbGroupWithMembers, DbHangoutSuggestion } from "@/types/database";

// ─── Decision key ─────────────────────────────────────────────────────────────
// Encodes the full RSVP state so we only re-evaluate when responses actually change.

function decisionKey(event: DbHangoutSuggestion): string {
  const rsvps = event.rsvps ?? [];
  const yes = rsvps.filter((r) => r.response === "yes").length;
  const no = rsvps.filter((r) => r.response === "no").length;
  const maybe = rsvps.filter((r) => r.response === "maybe").length;
  const hasVote = event.vote_options != null ? "1" : "0";
  return `${event.id}-${yes}-${no}-${maybe}-${hasVote}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Sets up Realtime subscriptions for RSVPs and hangout_suggestions for this group,
 * evaluates decision rules after every RSVP change, and invokes the
 * process-hangout-decision Edge Function when a threshold is reached.
 *
 * Returns showConfetti: true when the current user has a "yes" RSVP on a
 * newly-confirmed event (used to trigger the celebration overlay).
 */
export function useRsvpDecision({
  groupId,
  group,
  events,
  currentUserId,
}: {
  groupId: string | undefined;
  group: DbGroupWithMembers | undefined;
  events: DbHangoutSuggestion[];
  currentUserId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const processedRef = useRef(new Set<string>());
  // Track which confirmed events we've already shown confetti for (per session)
  const confettiShownRef = useRef(new Set<string>());

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`rsvp-decision-${groupId}`)
      // RSVP changes (any — filter server-side would require knowing hangout IDs)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["events", "group", groupId],
          });
        },
      )
      // Hangout status/vote_options changes (confirmation, cancellation, vote start)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "hangout_suggestions",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["events", "group", groupId],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // ── Decision evaluation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!group || events.length === 0) return;

    const totalMembers = group.group_members.length;
    const month = new Date().getMonth() + 1;

    for (const event of events) {
      if (event.status !== "pending") continue;

      const key = decisionKey(event);
      if (processedRef.current.has(key)) continue;
      processedRef.current.add(key);

      const rsvps = event.rsvps ?? [];
      const yesCount = rsvps.filter((r) => r.response === "yes").length;
      const noCount = rsvps.filter((r) => r.response === "no").length;
      const maybeCount = rsvps.filter((r) => r.response === "maybe").length;

      // Guard: only apply rules once we have at least one non-pending RSVP
      if (yesCount + noCount + maybeCount === 0) continue;

      // Rule 1: majority confirms (>50%)
      if (yesCount / totalMembers > 0.5) {
        supabase.functions.invoke("process-hangout-decision", {
          body: { type: "confirm", hangoutId: event.id },
        });
        continue;
      }

      // Rule 2: 40%+ can't make it → cancel
      if (noCount / totalMembers >= 0.4) {
        supabase.functions.invoke("process-hangout-decision", {
          body: { type: "cancel", hangoutId: event.id },
        });
        continue;
      }

      // Rule 3: someone doesn't like the activity → start vote (only once)
      if (maybeCount >= 1 && event.vote_options == null) {
        const slot =
          event.start_time && event.end_time
            ? { start: event.start_time, end: event.end_time }
            : null;

        if (!slot || !group.group_interests.length) continue;

        const originalActivity = event.suggested_activity
          ? activityByName[event.suggested_activity] ?? null
          : null;
        const originalId = originalActivity?.id ?? null;

        const alts = suggestAlternatives(
          group.group_interests,
          slot,
          month,
          [originalId, group.last_suggested_activity_id],
          2,
        );

        supabase.functions.invoke("process-hangout-decision", {
          body: {
            type: "vote",
            hangoutId: event.id,
            voteOptions: {
              originalId,
              alt1Id: alts[0]?.id ?? null,
              alt2Id: alts[1]?.id ?? null,
            },
          },
        });
      }
    }
  }, [events, group]);

  // ── Confetti detection ─────────────────────────────────────────────────────
  // Show confetti once per confirmed event where the current user said yes.
  const showConfetti = events.some((e) => {
    if (e.status !== "confirmed") return false;
    if (confettiShownRef.current.has(e.id)) return false;
    const myRsvp = e.rsvps?.find((r) => r.user_id === currentUserId);
    if (myRsvp?.response !== "yes") return false;
    confettiShownRef.current.add(e.id);
    return true;
  });

  return { showConfetti };
}
