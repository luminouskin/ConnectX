import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, AtSign, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function SetupProfile() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSetup = async () => {
    setError("");
    if (username.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError("Only letters, numbers and underscores allowed"); return; }
    if (!displayName.trim()) { setError("Display name is required"); return; }

    setLoading(true);

    const { data: existing } = await supabase
      .from("profiles").select("id").eq("username", username.toLowerCase()).single();

    if (existing) { setError("Username already taken, try another"); setLoading(false); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: username.toLowerCase(), display_name: displayName.trim() })
      .eq("id", session.user.id);

    setLoading(false);
    if (updateError) { setError("Something went wrong, please try again"); }
    else { window.location.href = "/"; }
  };

  const inputStyle = (field: string) => ({
    padding: "12px 14px 12px 42px",
    background: "#0D1117",
    border: `1px solid ${focusedField === field ? "rgba(124,110,250,0.6)" : "rgba(255,255,255,0.06)"}`,
    borderRadius: "12px",
    color: "white",
    fontSize: 14,
    outline: "none",
    width: "100%",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(124,110,250,0.12)" : "none",
  });

  return (
    <div style={{
      height: "100vh",
      background: "#080B14",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        input::placeholder { color: #374151; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #0D1117 inset !important;
          -webkit-text-fill-color: white !important;
        }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.12) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"drift1 12s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 15s ease-in-out infinite", pointerEvents:"none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(124,110,250,0.15)",
          padding: "48px 40px",
          borderRadius: "20px",
          color: "white",
          width: 380,
          boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #7C6EFA, #A78BFA)",
            borderRadius: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 24px rgba(124,110,250,0.35)",
          }}
        >
          <User size={26} color="white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 32 }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}>
            Set up your profile
          </h2>
          <p style={{ color: "#6B7280", margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Choose a username to get started
          </p>
        </motion.div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Username field */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <label style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Username
            </label>
            <div style={{ position: "relative" }}>
              <AtSign size={15} color={focusedField === "username" ? "#7C6EFA" : "#4B5563"} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "color 0.2s" }} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
                placeholder="yourname"
                style={inputStyle("username")}
              />
            </div>
          </motion.div>

          {/* Display Name field */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <label style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Display Name
            </label>
            <div style={{ position: "relative" }}>
              <User size={15} color={focusedField === "displayName" ? "#7C6EFA" : "#4B5563"} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", transition: "color 0.2s" }} />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onFocus={() => setFocusedField("displayName")}
                onBlur={() => setFocusedField(null)}
                placeholder="Your Name"
                style={inputStyle("displayName")}
              />
            </div>
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", alignItems: "center", gap: 8, color: "#F87171", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 10, padding: "10px 12px" }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSetup}
            disabled={loading}
            style={{
              padding: "13px",
              background: loading ? "#1A1F2E" : "linear-gradient(135deg, #7C6EFA, #A78BFA)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 4,
              transition: "background 0.3s ease",
              boxShadow: loading ? "none" : "0 4px 20px rgba(124,110,250,0.35)",
              letterSpacing: "0.1px",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Setting up...
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} />
              </>
            )}
          </motion.button>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </motion.div>
    </div>
  );
}