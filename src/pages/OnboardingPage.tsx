import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCompleteOnboarding } from "@/hooks/useInvites";
import { usePostHog } from "@posthog/react";

// ─── E.164 validation ─────────────────────────────────────────────────────────

function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

// ─── Component ────────────────────────────────────────────────────────────────

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const completeOnboarding = useCompleteOnboarding();
  const posthog = usePostHog();

  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const firstName = profile?.display_name?.split(" ")[0] ?? "friend";

  const handleSave = async () => {
    const trimmed = phone.trim();
    if (!isE164(trimmed)) {
      setPhoneError("Must be in E.164 format, e.g. +13105551234");
      return;
    }
    try {
      await completeOnboarding.mutateAsync({ phoneNumber: trimmed });
      posthog.capture("onboarding_completed", { phone_provided: true });
      toast.success("Phone number saved!");
      navigate("/dashboard", { replace: true });
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleSkip = async () => {
    posthog.capture("onboarding_skipped");
    try {
      await completeOnboarding.mutateAsync({ phoneNumber: null });
    } catch {
      // Non-fatal — proceed regardless
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-md mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="w-full"
      >
        {/* Icon */}
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Phone size={24} className="text-primary" />
        </div>

        <h1 className="text-heading text-xl mb-1">One quick thing, {firstName}</h1>
        <p className="text-body text-sm mb-8">
          Add your phone number so friends can invite you to groups by text.
          You can always skip this and add it later in your profile.
        </p>

        {/* Input */}
        <div className="glass-surface rounded-lg p-5 text-left mb-5">
          <label className="font-mono-data text-muted-foreground text-[11px] uppercase block mb-2">
            Phone number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPhoneError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="+13105551234"
            autoFocus
            className="w-full bg-secondary rounded-md px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground font-mono-data outline-none focus:ring-1 focus:ring-primary transition-shadow"
          />
          {phoneError ? (
            <p className="font-mono-data text-[10px] text-destructive mt-1.5 uppercase">
              {phoneError}
            </p>
          ) : (
            <p className="font-mono-data text-[10px] text-muted-foreground mt-1.5 uppercase">
              E.164 format · e.g. +13105551234
            </p>
          )}
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSave}
          disabled={completeOnboarding.isPending}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss disabled:opacity-60 mb-4"
        >
          {completeOnboarding.isPending ? "Saving…" : "Save phone number"}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSkip}
          disabled={completeOnboarding.isPending}
          className="flex items-center gap-1.5 mx-auto text-muted-foreground text-sm font-mono-data hover:text-foreground transition-colors disabled:opacity-50"
        >
          Add later <ArrowRight size={14} />
        </motion.button>
      </motion.div>
    </div>
  );
};

export default OnboardingPage;
