import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "http://localhost:5173" },
    });
    if (error) alert(error.message);
  };

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

      {/* Ambient orbs */}
      <div style={{
        position: "absolute", width: 500, height: 500,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,110,250,0.12) 0%, transparent 70%)",
        top: "-100px", left: "-100px",
        animation: "drift1 12s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 400, height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)",
        bottom: "-80px", right: "-80px",
        animation: "drift2 15s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 300, height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(196,181,253,0.07) 0%, transparent 70%)",
        top: "40%", right: "20%",
        animation: "drift1 18s ease-in-out infinite reverse",
        pointerEvents: "none",
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, 20px); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-25px, -15px); }
        }
        .google-btn:hover {
          background: #1A1F2E !important;
          border-color: #7C6EFA !important;
          box-shadow: 0 0 20px rgba(124,110,250,0.2) !important;
          transform: translateY(-1px) !important;
        }
        .google-btn:active {
          transform: translateY(0px) !important;
        }
      `}</style>

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
          textAlign: "center",
          width: 360,
          boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo mark */}
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
          <Zap size={26} color="white" fill="white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}
        >
          ConnectX
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          style={{ color: "#6B7280", margin: "0 0 36px", fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
        >
          Private messaging for your crew
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          onClick={signInWithGoogle}
          className="google-btn"
          style={{
            width: "100%",
            padding: "13px 20px",
            background: "#111827",
            color: "white",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            transition: "all 0.2s ease",
            letterSpacing: "0.1px",
          }}
        >
          {/* Google SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
          </svg>
          Continue with Google
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          style={{ color: "#374151", fontSize: 12, margin: "24px 0 0", lineHeight: 1.6 }}
        >
          By continuing, you agree to our Terms of Service
        </motion.p>
      </motion.div>
    </div>
  );
}