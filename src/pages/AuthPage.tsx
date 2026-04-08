import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cyaTransition } from "@/lib/motion";
import { useAuth } from "@/contexts/AuthContext";

const AuthPage = () => {
  const { signInWithGoogle, isLoading, session } = useAuth();
  const navigate = useNavigate();

  // Redirect already-authenticated users straight to their dashboard
  useEffect(() => {
    if (!isLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cyaTransition}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">cya</h1>
          <p className="text-body mt-1">see friends more.</p>
        </div>

        <div className="glass-surface rounded-lg p-6">
          <p className="text-sm text-muted-foreground text-center mb-5">
            Sign in to coordinate hangouts with your friends.
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={signInWithGoogle}
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-md shadow-gloss hover:shadow-gloss-hover transition-shadow duration-150 disabled:opacity-50"
          >
            Continue with Google
          </motion.button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-mono-data">
          v0.1 • coordination engine
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
