import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, User, AtSign, FileText, Check, Loader2 } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
      }
    };

    getProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio })
      .eq("id", session.user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const inputStyle = (field: string): React.CSSProperties => ({
    padding: "11px 14px 11px 42px",
    background: "#0D1117",
    border: `1px solid ${focusedField === field ? "rgba(124,110,250,0.6)" : "rgba(255,255,255,0.06)"}`,
    borderRadius: 12,
    color: "white",
    fontSize: 14,
    outline: "none",
    width: "100%",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(124,110,250,0.1)" : "none",
  });

  const textareaStyle: React.CSSProperties = {
    padding: "11px 14px 11px 42px",
    background: "#0D1117",
    border: `1px solid ${focusedField === "bio" ? "rgba(124,110,250,0.6)" : "rgba(255,255,255,0.06)"}`,
    borderRadius: 12,
    color: "white",
    fontSize: 14,
    outline: "none",
    width: "100%",
    fontFamily: "'Inter', sans-serif",
    boxSizing: "border-box",
    resize: "none",
    lineHeight: 1.6,
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxShadow: focusedField === "bio" ? "0 0 0 3px rgba(124,110,250,0.1)" : "none",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080B14",
      color: "white",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontFamily: "'Inter', sans-serif",
      position: "relative",
      overflow: "hidden",
      padding: "24px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder { color: #374151; }
        textarea::placeholder { color: #374151; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #0D1117 inset !important;
          -webkit-text-fill-color: white !important;
        }
        input:disabled { cursor: not-allowed; }
      `}</style>

      {/* Orbs */}
      <div style={{ position:"fixed", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.09) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"drift1 14s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"fixed", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 18s ease-in-out infinite", pointerEvents:"none" }} />

      <motion.div
        initial={{ opacity:0, y:24, scale:0.97 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.55, ease:[0.22,1,0.36,1] }}
        style={{
          background: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(124,110,250,0.12)",
          borderRadius: 22,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02) inset",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {/* Top violet strip */}
        <div style={{ height: 3, background: "linear-gradient(90deg, #7C6EFA, #A78BFA, #7C6EFA)", backgroundSize:"200% 100%", animation:"shimmer 3s ease-in-out infinite" }} />

        <style>{`
          @keyframes shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        `}</style>

        <div style={{ padding: "28px 32px 32px" }}>

          {/* Header */}
          <motion.div
            initial={{ opacity:0, y:-8 }}
            animate={{ opacity:1, y:0 }}
            transition={{ delay:0.15, duration:0.4 }}
            style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}
          >
            <motion.button
              whileHover={{ scale:1.05 }}
              whileTap={{ scale:0.95 }}
              onClick={() => navigate("/")}
              style={{ width:36, height:36, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0 }}
            >
              <ArrowLeft size={16} />
            </motion.button>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:700, letterSpacing:"-0.3px" }}>Edit Profile</h2>
              <p style={{ margin:0, fontSize:11, color:"#4B5563", marginTop:1 }}>Update your public info</p>
            </div>
          </motion.div>

          {/* Avatar */}
          <motion.div
            initial={{ opacity:0, scale:0.85 }}
            animate={{ opacity:1, scale:1 }}
            transition={{ delay:0.2, duration:0.45, ease:[0.22,1,0.36,1] }}
            style={{ display:"flex", justifyContent:"center", marginBottom:28 }}
          >
            <div style={{ position:"relative" }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="avatar"
                  style={{ width:84, height:84, borderRadius:"50%", border:"2px solid rgba(124,110,250,0.4)", display:"block" }}
                />
              ) : (
                <div style={{ width:84, height:84, borderRadius:"50%", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:700, border:"2px solid rgba(124,110,250,0.3)" }}>
                  {getInitials(displayName || profile?.display_name || "")}
                </div>
              )}
              {/* Online dot */}
              <div style={{ position:"absolute", bottom:4, right:4, width:14, height:14, borderRadius:"50%", background:"#34D399", border:"2px solid #080B14" }} />
            </div>
          </motion.div>

          {/* Fields */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Display Name */}
            <motion.div initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.3, duration:0.35 }}>
              <label style={{ color:"#9CA3AF", fontSize:11, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", display:"block", marginBottom:7 }}>
                Display Name
              </label>
              <div style={{ position:"relative" }}>
                <User size={14} color={focusedField === "displayName" ? "#7C6EFA" : "#374151"} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", transition:"color 0.2s", pointerEvents:"none" }} />
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => setFocusedField("displayName")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your name"
                  style={inputStyle("displayName")}
                />
              </div>
            </motion.div>

            {/* Username (disabled) */}
            <motion.div initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.38, duration:0.35 }}>
              <label style={{ color:"#9CA3AF", fontSize:11, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", display:"block", marginBottom:7 }}>
                Username
              </label>
              <div style={{ position:"relative" }}>
                <AtSign size={14} color="#1F2937" style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                <input
                  value={profile?.username || ""}
                  disabled
                  style={{ ...inputStyle("username"), color:"#374151", border:"1px solid rgba(255,255,255,0.03)", cursor:"not-allowed" }}
                />
              </div>
              <p style={{ margin:"6px 0 0 2px", color:"#1F2937", fontSize:11 }}>Username cannot be changed yet</p>
            </motion.div>

            {/* Bio */}
            <motion.div initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.46, duration:0.35 }}>
              <label style={{ color:"#9CA3AF", fontSize:11, fontWeight:600, letterSpacing:"0.6px", textTransform:"uppercase", display:"block", marginBottom:7 }}>
                Bio
              </label>
              <div style={{ position:"relative" }}>
                <FileText size={14} color={focusedField === "bio" ? "#7C6EFA" : "#374151"} style={{ position:"absolute", left:14, top:14, transition:"color 0.2s", pointerEvents:"none" }} />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  onFocus={() => setFocusedField("bio")}
                  onBlur={() => setFocusedField(null)}
                  rows={3}
                  placeholder="Tell people a little about yourself..."
                  style={textareaStyle}
                />
              </div>
            </motion.div>

            {/* Save button */}
            <motion.div
              initial={{ opacity:0, y:8 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:0.54, duration:0.35 }}
              style={{ marginTop:4 }}
            >
              <motion.button
                whileHover={{ scale: saving || saved ? 1 : 1.01 }}
                whileTap={{ scale: saving || saved ? 1 : 0.98 }}
                onClick={saveProfile}
                disabled={saving}
                style={{
                  width:"100%",
                  padding:"13px",
                  background: saved
                    ? "rgba(52,211,153,0.12)"
                    : saving
                    ? "#1A1F2E"
                    : "linear-gradient(135deg,#7C6EFA,#A78BFA)",
                  color: saved ? "#34D399" : "white",
                  border: saved ? "1px solid rgba(52,211,153,0.25)" : "none",
                  borderRadius:13,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize:15,
                  fontWeight:600,
                  fontFamily:"'Inter',sans-serif",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  gap:8,
                  transition:"background 0.3s ease, color 0.3s ease, border 0.3s ease",
                  boxShadow: saved || saving ? "none" : "0 4px 20px rgba(124,110,250,0.35)",
                  letterSpacing:"0.1px",
                }}
              >
                <AnimatePresence mode="wait">
                  {saving && (
                    <motion.span key="saving" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.8 }} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Loader2 size={16} style={{ animation:"spin 1s linear infinite" }} />
                      Saving...
                    </motion.span>
                  )}
                  {!saving && saved && (
                    <motion.span key="saved" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.8 }} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Check size={16} />
                      Saved
                    </motion.span>
                  )}
                  {!saving && !saved && (
                    <motion.span key="idle" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                      Save changes
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}