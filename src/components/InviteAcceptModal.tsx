import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, X } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useRespondToDirectInvite } from "@/hooks/useInvites";
import type { DbGroupInvite } from "@/types/database";

// ─── Component ────────────────────────────────────────────────────────────────

interface InviteAcceptModalProps {
  /** The pending group_invites row, with inviter and groups joined. */
  invite: DbGroupInvite;
  onDismiss: () => void;
}

export default function InviteAcceptModal({ invite, onDismiss }: InviteAcceptModalProps) {
  const respond = useRespondToDirectInvite();
  const [action, setAction] = useState<"idle" | "joining" | "declining">("idle");

  const groupName = invite.groups?.name ?? "the group";
  const inviterName = invite.inviter?.display_name ?? invite.users?.display_name ?? "Someone";

  const handleJoin = async () => {
    setAction("joining");
    try {
      const result = await respond.mutateAsync({
        inviteId: invite.id,
        groupId: invite.group_id,
        type: "accept-direct",
      });
      if (result.ok) {
        toast.success(`Welcome to ${result.groupName ?? groupName}!`);
        onDismiss();
      } else {
        toast.error("Could not join the group. The invite may have expired.");
        setAction("idle");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setAction("idle");
    }
  };

  const handleDecline = async () => {
    setAction("declining");
    try {
      await respond.mutateAsync({
        inviteId: invite.id,
        groupId: invite.group_id,
        type: "decline",
      });
      onDismiss();
    } catch {
      toast.error("Something went wrong.");
      setAction("idle");
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="invite-accept-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Sheet */}
      <motion.div
        key="invite-accept-sheet"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={cyaTransition}
        className="fixed bottom-0 left-0 right-0 z-[60] max-w-lg mx-auto"
      >
        <div className="glass-surface rounded-t-2xl p-5 pb-[5.5rem]">
          {/* Handle + header */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="font-mono-data text-[10px] text-muted-foreground">INVITE</p>
              <h2 className="text-base font-medium text-foreground leading-tight">
                You've been invited
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

          {/* Invite card */}
          <div className="flex items-start gap-4 mb-8">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground leading-snug">
                {inviterName} invited you to join
              </p>
              <p className="text-primary font-medium text-sm mt-0.5">{groupName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Coordinate hangouts and see when everyone's free.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleJoin}
              disabled={action !== "idle"}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-50 transition-opacity"
            >
              {action === "joining" ? "Joining…" : "Join group"}
            </motion.button>
            <button
              onClick={handleDecline}
              disabled={action !== "idle"}
              className="w-full py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 font-mono-data"
            >
              {action === "declining" ? "Declining…" : "Decline"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
