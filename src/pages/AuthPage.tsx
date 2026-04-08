import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cyaTransition } from "@/lib/motion";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("cya-user", JSON.stringify({ name: name || "User", email }));
    navigate("/dashboard");
  };

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
          <div className="flex gap-1 mb-6 p-1 bg-secondary rounded-md">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-sm transition-all duration-150 ${
                isLogin ? "bg-background shadow-gloss text-foreground" : "text-muted-foreground"
              }`}
            >
              sign in
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-sm transition-all duration-150 ${
                !isLogin ? "bg-background shadow-gloss text-foreground" : "text-muted-foreground"
              }`}
            >
              sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={cyaTransition}
              >
                <label className="block text-xs font-mono-data text-muted-foreground mb-1.5">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
                  placeholder="your name"
                  required={!isLogin}
                />
              </motion.div>
            )}
            <div>
              <label className="block text-xs font-mono-data text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
                placeholder="you@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono-data text-muted-foreground mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
                placeholder="••••••••"
                required
              />
            </div>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.96 }}
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-md shadow-gloss hover:shadow-gloss-hover transition-shadow duration-150"
            >
              {isLogin ? "sign in" : "create account"}
            </motion.button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 font-mono-data">v0.1 • coordination engine</p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
