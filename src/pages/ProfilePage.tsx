import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Clock, LogOut } from "lucide-react";
import { cyaTransition } from "@/lib/motion";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { useAuth } from "@/contexts/AuthContext";
import { usePostHog } from "@posthog/react";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const posthog = usePostHog();

  const displayName = profile?.display_name ?? "User";
  const email = profile?.email ?? "";

  const handleLogout = async () => {
    posthog.capture("user_signed_out");
    await signOut();
    navigate("/");
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl text-heading">Profile</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="glass-surface rounded-lg p-5 mb-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-lg font-medium text-secondary-foreground">
            {displayName[0] ?? "U"}
          </div>
          <div>
            <p className="text-base font-medium text-foreground">{displayName}</p>
            <p className="font-mono-data text-muted-foreground text-[11px]">{email}</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cyaTransition, delay: 0.05 }}
        className="glass-surface rounded-lg p-4 mb-4"
      >
        <h2 className="font-mono-data text-muted-foreground mb-3">Availability</h2>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate("/availability")}
          className="w-full flex items-center justify-between py-2"
        >
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground">Edit Busy Times</span>
          </div>
          <span className="text-primary text-xs font-mono-data">EDIT →</span>
        </motion.button>
        <p className="text-body text-xs mt-1">
          Set your regular busy hours so the app knows when you're unavailable.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...cyaTransition, delay: 0.1 }}
        className="glass-surface rounded-lg p-4 mb-4"
      >
        <h2 className="font-mono-data text-muted-foreground mb-3">Calendar Integration</h2>
        <GoogleCalendarConnect variant="row" />
        <p className="text-body text-xs mt-2">
          Connect your calendar to automatically sync your availability with groups.
        </p>
      </motion.div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={handleLogout}
        className="w-full py-3 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:shadow-gloss-hover transition-shadow"
      >
        <LogOut size={14} /> sign out
      </motion.button>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          to="/privacy"
          className="font-mono-data text-muted-foreground text-[10px] hover:text-foreground transition-colors"
        >
          PRIVACY POLICY
        </Link>
        <span className="text-border">·</span>
        <Link
          to="/terms"
          className="font-mono-data text-muted-foreground text-[10px] hover:text-foreground transition-colors"
        >
          TERMS OF SERVICE
        </Link>
      </div>
      <p className="text-center font-mono-data text-muted-foreground text-[10px] mt-2">
        cya v0.1 • coordination engine
      </p>
    </div>
  );
};

export default ProfilePage;
