import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSubmitFeedback } from "@/hooks/useFeedback";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedbackType = "bug" | "suggestion";

const BUG_PAGES = [
  "Dashboard",
  "Group Page",
  "Calendar",
  "Activity Suggestions",
  "RSVP Flow",
  "Invite Flow",
  "Profile / Settings",
  "Notifications",
  "Other",
] as const;

// ─── Browser / OS helpers ────────────────────────────────────────────────────

function parseBrowser(ua: string): string {
  if (/Edg\//.test(ua)) {
    const v = ua.match(/Edg\/([\d.]+)/)?.[1] ?? "";
    return `Edge ${v}`.trim();
  }
  if (/OPR\//.test(ua)) {
    const v = ua.match(/OPR\/([\d.]+)/)?.[1] ?? "";
    return `Opera ${v}`.trim();
  }
  if (/Chrome\//.test(ua)) {
    const v = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? "";
    return `Chrome ${v}`.trim();
  }
  if (/Firefox\//.test(ua)) {
    const v = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? "";
    return `Firefox ${v}`.trim();
  }
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
    const v = ua.match(/Version\/([\d.]+)/)?.[1] ?? "";
    return `Safari ${v}`.trim();
  }
  return "Unknown browser";
}

function parseOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) {
    const v = ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "";
    return `iOS ${v}`.trim();
  }
  if (/Android/.test(ua)) {
    const v = ua.match(/Android ([\d.]+)/)?.[1] ?? "";
    return `Android ${v}`.trim();
  }
  if (/Mac OS X/.test(ua)) {
    const v = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".") ?? "";
    return `macOS ${v}`.trim();
  }
  if (/Windows NT/.test(ua)) {
    const ntMap: Record<string, string> = {
      "10.0": "11/10", "6.3": "8.1", "6.2": "8", "6.1": "7",
    };
    const nt = ua.match(/Windows NT ([\d.]+)/)?.[1] ?? "";
    return `Windows ${ntMap[nt] ?? nt}`.trim();
  }
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
}

function collectTechContext() {
  const ua = navigator.userAgent;
  return {
    browser: parseBrowser(ua),
    os: parseOS(ua),
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    app_version: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "0.0.0",
    page_url: window.location.href,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FeedbackModalProps {
  onDismiss: () => void;
}

const MIN_CHARS = 20;

export default function FeedbackModal({ onDismiss }: FeedbackModalProps) {
  const { user, profile } = useAuth();
  const submitFeedback = useSubmitFeedback();

  const [type, setType] = useState<FeedbackType>("bug");
  const [page, setPage] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Collect tech context once on mount (when the modal opens)
  const [techCtx] = useState(() => collectTechContext());

  // Reset form fields whenever type switches
  useEffect(() => {
    setPage("");
    setMessage("");
  }, [type]);

  const canSubmit = message.trim().length >= MIN_CHARS && !submitFeedback.isPending;
  const charsLeft = Math.max(0, MIN_CHARS - message.trim().length);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await submitFeedback.mutateAsync({
        user_id: user?.id ?? null,
        type,
        page: type === "bug" ? (page || null) : null,
        message: message.trim(),
        browser: techCtx.browser,
        os: techCtx.os,
        screen_resolution: techCtx.screen_resolution,
        app_version: techCtx.app_version,
        user_email: profile?.email ?? null,
        user_display_name: profile?.display_name ?? null,
      });
      setIsSubmitted(true);
    } catch {
      // Error state is surfaced via submitFeedback.isError below
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="feedback-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Sheet */}
      <motion.div
        key="feedback-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={cyaTransition}
        className="fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto"
      >
        <div className="glass-surface rounded-t-2xl flex flex-col max-h-[85dvh] overflow-hidden">

          {/* ── Scrollable content ─────────────────────────────────────────── */}
          <div className="overflow-y-auto flex-1 p-5 pb-3">

            {/* Handle + header */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-mono-data text-[10px] text-muted-foreground">FEEDBACK</p>
                <h2 className="text-base font-medium text-foreground leading-tight">
                  {isSubmitted ? "Sent!" : "Send Feedback"}
                </h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onDismiss}
                className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center shrink-0"
              >
                <X size={14} className="text-muted-foreground" />
              </motion.button>
            </div>

            {isSubmitted ? (
              /* ── Confirmation ────────────────────────────────────────────── */
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={cyaTransition}
                className="py-6 text-center"
              >
                <p className="text-2xl mb-3">🙏</p>
                <p className="text-sm font-medium text-foreground">
                  Thanks for your feedback!
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-snug">
                  It helps us make cya better for everyone.
                </p>
              </motion.div>
            ) : (
              /* ── Form ────────────────────────────────────────────────────── */
              <div className="space-y-4">

                {/* Type selector */}
                <div>
                  <p className="font-mono-data text-[10px] text-muted-foreground mb-2 uppercase">
                    What kind of feedback?
                  </p>
                  <div className="flex gap-2">
                    {(["bug", "suggestion"] as const).map((t) => (
                      <motion.button
                        key={t}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setType(t)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                          type === t
                            ? "bg-primary text-primary-foreground shadow-gloss"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {t === "bug" ? "🐛 Bug / Error" : "💡 Suggestion"}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Page selector — bugs only */}
                <AnimatePresence>
                  {type === "bug" && (
                    <motion.div
                      key="page-selector"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <label className="block font-mono-data text-[10px] text-muted-foreground mb-2 uppercase">
                        Which page or feature?
                      </label>
                      <select
                        value={page}
                        onChange={(e) => setPage(e.target.value)}
                        className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-shadow appearance-none"
                      >
                        <option value="">Select a page…</option>
                        {BUG_PAGES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Message textarea */}
                <div>
                  <label className="block font-mono-data text-[10px] text-muted-foreground mb-2 uppercase">
                    {type === "bug" ? "What happened?" : "Your idea"}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "Describe what happened and what you expected to happen..."
                        : "Tell us your idea..."
                    }
                    rows={5}
                    className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-shadow resize-none font-sans leading-relaxed"
                  />
                  {charsLeft > 0 && (
                    <p className="font-mono-data text-[10px] text-muted-foreground mt-1">
                      {charsLeft} more character{charsLeft !== 1 ? "s" : ""} needed
                    </p>
                  )}
                </div>

                {/* Error */}
                {submitFeedback.isError && (
                  <p className="text-xs text-destructive font-mono-data">
                    Something went wrong — please try again.
                  </p>
                )}

              </div>
            )}
          </div>

          {/* ── Sticky footer ─────────────────────────────────────────────── */}
          <div className="flex-shrink-0 px-5 pt-3 pb-[5.5rem] border-t border-border/30 bg-background/80 backdrop-blur-sm">
            {isSubmitted ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onDismiss}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss"
              >
                Done
              </motion.button>
            ) : (
              <div className="space-y-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {submitFeedback.isPending ? "Sending…" : "Submit Feedback"}
                </motion.button>
                <button
                  onClick={onDismiss}
                  className="w-full py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
