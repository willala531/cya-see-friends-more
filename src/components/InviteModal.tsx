import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupInvites, useCreateInvite } from "@/hooks/useInvites";
import type { DbGroupInvite } from "@/types/database";

// ─── E.164 validation ─────────────────────────────────────────────────────────

function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// ─── Pending invite row ───────────────────────────────────────────────────────

interface InviteRowProps {
  invite: DbGroupInvite;
  currentUserId: string;
  onResend: (invite: DbGroupInvite) => void;
  isResending: boolean;
}

function InviteRow({ invite, currentUserId, onResend, isResending }: InviteRowProps) {
  const isMine = invite.invited_by === currentUserId;
  const isResendable = differenceInHours(new Date(), new Date(invite.created_at)) >= 24;
  const expiresIn = formatDistanceToNow(new Date(invite.expires_at), { addSuffix: false });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={cyaTransition}
      className="glass-surface rounded-md p-3 flex items-center justify-between"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono-data text-xs text-foreground">{invite.phone_number}</p>
        <p className="font-mono-data text-[10px] text-muted-foreground mt-0.5">
          Invited by {isMine ? "you" : (invite.users?.display_name ?? "a member")}
          {" · "}
          <Clock size={9} className="inline -mt-0.5" /> expires in {expiresIn}
        </p>
      </div>
      {isMine && isResendable && (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => onResend(invite)}
          disabled={isResending}
          className="ml-3 flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-[11px] font-mono-data disabled:opacity-50"
        >
          {isResending ? "…" : "Resend"}
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface InviteModalProps {
  groupId: string;
  onDismiss: () => void;
}

export default function InviteModal({ groupId, onDismiss }: InviteModalProps) {
  const { user } = useAuth();
  const { data: invites = [] } = useGroupInvites(groupId);
  const createInvite = useCreateInvite();

  const [phone, setPhone] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = phone.trim();
    if (!isE164(trimmed)) {
      toast.error("Enter a valid phone number in E.164 format, e.g. +13105551234");
      return;
    }

    try {
      const result = await createInvite.mutateAsync({ groupId, phoneNumber: trimmed });
      setPhone("");

      if (result.type === "existing_user") {
        toast.success(result.message);
      } else {
        if (result.warning) {
          toast.success("Invite created!", {
            description: result.warning,
          });
        } else {
          toast.success("SMS sent!");
        }
      }
    } catch {
      toast.error("Failed to send invite");
    }
  };

  const handleResend = async (invite: DbGroupInvite) => {
    setResendingId(invite.id);
    try {
      const result = await createInvite.mutateAsync({
        groupId,
        phoneNumber: invite.phone_number,
      });

      if (result.type === "existing_user") {
        toast.success(result.message);
      } else {
        toast.success(result.warning ? "Invite created!" : "SMS resent!");
      }
    } catch {
      toast.error("Failed to resend");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 bg-black/40 z-40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", ease: [0.2, 0, 0, 1], duration: 0.35 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-background rounded-t-2xl shadow-xl"
      >
        <div className="p-5 max-h-[85vh] overflow-y-auto">
          {/* Handle + header */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-medium text-foreground">Invite members</h2>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onDismiss}
              className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"
            >
              <X size={14} className="text-muted-foreground" />
            </motion.button>
          </div>

          {/* Phone input */}
          <div className="flex gap-2 mb-2">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="+13105551234"
              className="flex-1 bg-secondary rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground font-mono-data outline-none focus:ring-1 focus:ring-primary transition-shadow"
            />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleSend}
              disabled={createInvite.isPending}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-60"
            >
              <Send size={13} />
              {createInvite.isPending ? "…" : "Send"}
            </motion.button>
          </div>
          <p className="font-mono-data text-[10px] text-muted-foreground mb-4 uppercase">
            E.164 format · e.g. +13105551234
          </p>

          {/* Pending invite list */}
          {invites.length > 0 && (
            <div className="mt-5">
              <p className="font-mono-data text-muted-foreground text-[11px] uppercase mb-2">
                Pending invites
              </p>
              <div className="space-y-2">
                {invites.map((invite) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    currentUserId={user?.id ?? ""}
                    onResend={handleResend}
                    isResending={resendingId === invite.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
