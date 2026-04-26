import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useCreateGroup } from "@/hooks/useGroups";
import { useCreateInvite } from "@/hooks/useInvites";
import DevInviteLinks from "@/components/DevInviteLinks";

// ─── E.164 validation ─────────────────────────────────────────────────────────

function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InviteLink {
  phoneNumber: string;
  inviteUrl: string;
}

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const createInvite = useCreateInvite();

  const [step, setStep] = useState<"name" | "invite" | "done">("name");
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);

  // Phone invite state
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneList, setPhoneList] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [devLinks, setDevLinks] = useState<InviteLink[]>([]);

  // ── Step 1: create the group ─────────────────────────────────────────────

  const handleNext = () => {
    if (!groupName.trim()) {
      toast.error("Enter a group name");
      return;
    }
    createGroup.mutate(groupName, {
      onSuccess: (group) => {
        setGroupId(group.id);
        setStep("invite");
      },
      onError: () => toast.error("Failed to create group"),
    });
  };

  // ── Phone list management ─────────────────────────────────────────────────

  const handleAddPhone = () => {
    const trimmed = phoneInput.trim();
    if (!isE164(trimmed)) {
      setPhoneError("Must be in E.164 format, e.g. +13105551234");
      return;
    }
    if (phoneList.includes(trimmed)) {
      setPhoneError("Already added");
      return;
    }
    setPhoneList((prev) => [...prev, trimmed]);
    setPhoneInput("");
    setPhoneError("");
  };

  const handleRemovePhone = (phone: string) => {
    setPhoneList((prev) => prev.filter((p) => p !== phone));
  };

  // ── Step 2: send invites then go to group page ────────────────────────────

  const handleSendInvites = async () => {
    if (!groupId) return;
    if (phoneList.length === 0) {
      // Skip straight to the group page
      navigate(`/group/${groupId}`);
      return;
    }

    setIsSending(true);
    const links: InviteLink[] = [];

    for (const phoneNumber of phoneList) {
      try {
        const result = await createInvite.mutateAsync({ groupId, phoneNumber });
        links.push({ phoneNumber, inviteUrl: result.inviteUrl });
      } catch {
        toast.error(`Failed to invite ${phoneNumber}`);
      }
    }

    setDevLinks(links);
    setIsSending(false);

    if (links.length > 0) {
      toast.success(
        `Invite${links.length > 1 ? "s" : ""} created for ${links.length} number${links.length > 1 ? "s" : ""}!`,
      );
      setStep("done");
    }
  };

  const handleSkip = () => {
    if (groupId) navigate(`/group/${groupId}`);
  };

  const handleGoToGroup = () => {
    if (groupId) navigate(`/group/${groupId}`);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => {
            if (step === "name") navigate("/dashboard");
            else if (step === "invite") setStep("name");
            // "done" step has no back — user should proceed to group
          }}
          className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center hover:shadow-gloss-hover transition-shadow"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg text-heading">New Group</h1>
          <p className="font-mono-data text-muted-foreground text-[11px]">
            {step === "name" ? "step 1 of 2" : step === "invite" ? "step 2 of 2" : "all done!"}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Group name ──────────────────────────────────────────── */}
        {step === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={cyaTransition}
          >
            <div className="glass-surface rounded-lg p-5 mb-6">
              <h2 className="font-mono-data text-muted-foreground mb-3">Group Name</h2>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                placeholder="e.g. Friday Crew, Hiking Pals"
                autoFocus
                className="w-full bg-secondary rounded-md px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-shadow"
              />
              <p className="text-body text-xs mt-2">
                Pick a name your friends will recognize.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleNext}
              disabled={createGroup.isPending}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {createGroup.isPending ? "Creating…" : <>Next <ArrowRight size={16} /></>}
            </motion.button>
          </motion.div>
        )}

        {/* ── Step 2: Invite friends by phone ────────────────────────────── */}
        {step === "invite" && (
          <motion.div
            key="invite"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={cyaTransition}
          >
            {/* Intro card */}
            <div className="glass-surface rounded-lg p-5 mb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-foreground">
                    Invite friends to{" "}
                    <span className="text-primary">{groupName}</span>
                  </h2>
                  <p className="text-body text-xs mt-0.5">
                    Enter their phone numbers below.
                  </p>
                </div>
              </div>

              {/* Phone input */}
              <div className="flex gap-2 mb-1">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setPhoneError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPhone()}
                  placeholder="+13105551234"
                  className="flex-1 bg-secondary rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground font-mono-data outline-none focus:ring-1 focus:ring-primary transition-shadow"
                />
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleAddPhone}
                  className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center shadow-gloss"
                >
                  <Plus size={18} />
                </motion.button>
              </div>

              {phoneError && (
                <p className="font-mono-data text-[10px] text-destructive mt-1 uppercase">
                  {phoneError}
                </p>
              )}
              {!phoneError && (
                <p className="font-mono-data text-[10px] text-muted-foreground mt-1 uppercase">
                  E.164 format · e.g. +13105551234
                </p>
              )}

              {/* Added phone chips */}
              <AnimatePresence>
                {phoneList.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-1.5"
                  >
                    <p className="font-mono-data text-[10px] text-muted-foreground uppercase mb-2">
                      {phoneList.length} number{phoneList.length > 1 ? "s" : ""} added
                    </p>
                    {phoneList.map((phone) => (
                      <motion.div
                        key={phone}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={cyaTransition}
                        className="flex items-center justify-between bg-secondary rounded-md px-3 py-2"
                      >
                        <span className="font-mono-data text-sm text-foreground">
                          {phone}
                        </span>
                        <button
                          onClick={() => handleRemovePhone(phone)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-2"
                        >
                          <X size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Actions */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSendInvites}
              disabled={isSending || phoneList.length === 0}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-60 mb-3"
            >
              {isSending
                ? "Sending invites…"
                : phoneList.length > 0
                  ? `Send ${phoneList.length} invite${phoneList.length > 1 ? "s" : ""}`
                  : "Send invites"}
            </motion.button>

            <button
              onClick={handleSkip}
              className="w-full text-center text-muted-foreground text-xs font-mono-data hover:text-foreground transition-colors"
            >
              skip — I'll invite people later
            </button>
          </motion.div>
        )}

        {/* ── Step 3: Done — show dev invite links ─────────────────────── */}
        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={cyaTransition}
          >
            <div className="glass-surface rounded-lg p-5 mb-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-primary" />
              </div>
              <h2 className="text-base font-medium text-foreground mb-1">
                {groupName} is ready!
              </h2>
              <p className="text-body text-xs">
                {devLinks.length} invite{devLinks.length > 1 ? "s" : ""} created. Share the links below with your friends for testing.
              </p>
            </div>

            {/* Dev invite links panel */}
            <DevInviteLinks links={devLinks} />

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleGoToGroup}
              className="w-full mt-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss"
            >
              Go to group →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateGroupPage;
