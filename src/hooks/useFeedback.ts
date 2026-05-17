import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DbFeedback } from "@/types/database";

// Payload shape expected by the insert mutation.
// Omits server-generated fields (id, created_at).
export type FeedbackPayload = Omit<DbFeedback, "id" | "created_at">;

/**
 * Inserts a feedback row into public.feedback.
 *
 * The database webhook on the feedback table automatically calls the
 * send-feedback-email Edge Function after insert — the frontend never
 * triggers that function directly, so email failure never blocks submission.
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async (payload: FeedbackPayload) => {
      const { data, error } = await supabase
        .from("feedback")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data as DbFeedback;
    },
  });
}
