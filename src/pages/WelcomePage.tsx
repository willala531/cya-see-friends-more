import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cyaTransition } from "@/lib/motion";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";

const WelcomePage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("cya-user") || '{"name":"User"}');

  const handleSkip = () => {
    localStorage.setItem("cya-onboarded", "true");
    navigate("/dashboard");
  };

  const handleConnected = () => {
    localStorage.setItem("cya-onboarded", "true");
    // Small delay so the success toast is visible before navigating
    setTimeout(() => navigate("/dashboard"), 1200);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 max-w-md mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
      >
        <h1 className="text-heading text-2xl mb-1">
          welcome, {user.name?.split(" ")[0] || "friend"}
        </h1>
        <p className="text-body text-sm">
          let's get you set up so your friends can find time with you.
        </p>
      </motion.div>

      <div className="mt-8 w-full">
        <GoogleCalendarConnect variant="card" onConnected={handleConnected} />
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...cyaTransition, delay: 0.25 }}
        whileTap={{ scale: 0.96 }}
        onClick={handleSkip}
        className="mt-5 flex items-center gap-1.5 text-muted-foreground text-sm font-mono-data hover:text-foreground transition-colors"
      >
        I'll do this later <ArrowRight size={14} />
      </motion.button>
    </div>
  );
};

export default WelcomePage;
