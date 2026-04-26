// TODO: Phase B — remove this entire component when Twilio SMS is live.
// In Phase B, the create-invite and process-invite Edge Functions will send a
// real SMS via Twilio. This panel exists purely so invite links can be opened
// in a second browser tab during local / staging testing.
//
// To remove in Phase B:
//   1. Delete this file.
//   2. Remove every <DevInviteLinks ... /> usage from CreateGroupPage and InviteModal.
//   3. Remove the inviteLinks state and the onInviteSent callback from those parents.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, FlaskConical } from "lucide-react";
import { cyaTransition } from "@/lib/motion";

interface InviteLink {
  phoneNumber: string;
  inviteUrl: string;
}

interface DevInviteLinksProps {
  links: InviteLink[];
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={handleCopy}
      className="shrink-0 flex items-center gap-1 text-[10px] font-mono-data px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? "COPIED" : "COPY"}
    </motion.button>
  );
}

/**
 * DEV ONLY — displays copyable invite links so they can be opened in a second
 * browser tab during testing. Remove in Phase B when Twilio is live.
 */
export default function DevInviteLinks({ links }: DevInviteLinksProps) {
  if (links.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="mt-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-4"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <FlaskConical size={13} className="text-amber-700" />
            <span className="font-mono-data text-[10px] font-bold text-amber-800 uppercase tracking-wide">
              Dev Only
            </span>
          </div>
          <span className="font-mono-data text-[10px] text-amber-700">
            · SMS not sent. Open these links in a second browser tab to test the invite flow.
          </span>
        </div>

        {/* Link list */}
        <div className="space-y-2">
          {links.map(({ phoneNumber, inviteUrl }) => (
            <div
              key={phoneNumber}
              className="rounded-md bg-white border border-amber-200 p-2.5"
            >
              <p className="font-mono-data text-[10px] text-amber-700 mb-1.5 uppercase">
                {phoneNumber}
              </p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-mono-data text-[11px] text-amber-900 truncate">
                  {inviteUrl}
                </p>
                <CopyButton url={inviteUrl} />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
