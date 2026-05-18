import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessInvite } from "@/hooks/useInvites";
import { supabase } from "@/lib/supabase";
import type { InviteLookup } from "@/types/database";
import { usePostHog } from "@posthog/react";

// ─── Storage key for cross-OAuth invite handoff ───────────────────────────────
export const INVITE_TOKEN_KEY = "cya-invite-token";

// ─── Component ────────────────────────────────────────────────────────────────

const InvitePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const processInvite = useProcessInvite();
  const posthog = usePostHog();

  const [invite, setInvite] = useState<InviteLookup | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "valid" | "invalid">("loading");
  const [actionState, setActionState] = useState<"idle" | "joining" | "declining" | "joined" | "declined">("idle");

  // ── Fetch invite data via get-invite Edge Function (no auth required) ──────
  useEffect(() => {
    if (!token) {
      setLoadState("invalid");
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-invite", {
          body: { token },
        });
        if (error || !data?.isValid) {
          setLoadState("invalid");
          return;
        }
        setInvite(data as InviteLookup);
        setLoadState("valid");
      } catch {
        setLoadState("invalid");
      }
    })();
  }, [token]);

  // ── Handle joining ─────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!invite || !token) return;

    if (!user) {
      // Store token so PostAuthHandler can complete the join after OAuth
      sessionStorage.setItem(INVITE_TOKEN_KEY, token);
      // signInWithGoogle is a page redirect — store group info for the welcome message
      sessionStorage.setItem("cya-invite-group-name", invite.groupName);
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      return;
    }

    // Already logged in — process immediately
    setActionState("joining");
    try {
      const result = await processInvite.mutateAsync({
        token,
        userId: user.id,
        type: "accept",
      });
      if (result.ok && result.groupId) {
        posthog.capture("invite_joined", { group_id: result.groupId, group_name: result.groupName });
        setActionState("joined");
        toast.success(`Welcome to ${result.groupName ?? "the group"}!`);
        setTimeout(() => {
          navigate(
            `/group/${result.groupId}?welcome=${encodeURIComponent(result.groupName ?? "")}`,
            { replace: true },
          );
        }, 1200);
      } else {
        toast.error("Could not join the group. The invite may have expired.");
        setActionState("idle");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setActionState("idle");
    }
  };

  // ── Handle declining ───────────────────────────────────────────────────────
  const handleDecline = async () => {
    if (!invite || !token) return;
    setActionState("declining");
    try {
      await processInvite.mutateAsync({
        token,
        userId: user?.id ?? "anonymous",
        type: "decline",
      });
      posthog.capture("invite_declined", { group_name: invite?.groupName });
      setActionState("declined");
    } catch {
      toast.error("Something went wrong");
      setActionState("idle");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-mono-data text-muted-foreground text-sm">Loading invite…</p>
      </div>
    );
  }

  if (loadState === "invalid") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cyaTransition}
        >
          <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-destructive" />
          </div>
          <h1 className="text-base font-medium text-foreground mb-2">
            Invite not found
          </h1>
          <p className="text-body text-sm">
            This invite link has expired or is no longer valid.
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/")}
            className="mt-6 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss"
          >
            Back to cya
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (actionState === "declined") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={cyaTransition}
        >
          <p className="text-base font-medium text-foreground mb-2">No worries!</p>
          <p className="text-body text-sm">
            You can always join later if you change your mind.
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Valid invite ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <p className="text-center font-mono-data text-muted-foreground text-xs mb-6 uppercase tracking-widest">
          cya
        </p>

        {/* Invite card */}
        <div className="glass-surface rounded-xl p-6 text-center">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {actionState === "joined" ? (
              <CheckCircle2 size={26} className="text-accent" />
            ) : (
              <Users size={26} className="text-primary" />
            )}
          </div>

          <h1 className="text-lg font-semibold text-foreground mb-1">
            {actionState === "joined"
              ? `You joined ${invite?.groupName}!`
              : `Join ${invite?.groupName}`}
          </h1>

          <p className="text-body text-sm mb-6">
            {actionState === "joined"
              ? "Redirecting you to the group…"
              : (
                <>
                  <span className="text-foreground font-medium">
                    {invite?.inviterName}
                  </span>{" "}
                  invited you to coordinate hangouts on cya.
                </>
              )}
          </p>

          {actionState !== "joined" && (
            <>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleJoin}
                disabled={actionState === "joining"}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-60 mb-3"
              >
                {actionState === "joining"
                  ? "Joining…"
                  : user
                    ? "Join group"
                    : "Sign in with Google to join"}
              </motion.button>

              <button
                onClick={handleDecline}
                disabled={actionState === "declining"}
                className="w-full py-2 text-muted-foreground text-sm font-mono-data hover:text-foreground transition-colors disabled:opacity-50"
              >
                {actionState === "declining" ? "Declining…" : "Decline"}
              </button>

              {!user && (
                <p className="mt-4 font-mono-data text-[10px] text-muted-foreground uppercase">
                  You'll be asked to sign in with Google
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default InvitePage;
