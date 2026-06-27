import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import SetupProfile from "./pages/SetupProfile";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import Stickers from "./pages/Stickers";
import CreateSticker from "./pages/CreateSticker";

// ── Fullscreen loading screen ──────────────────────────────────────────────
function AppLoader() {
  const [dot, setDot] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        background: "#080B14",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
        gap: 32,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.2; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.1) 0%, transparent 70%)", top:"-120px", left:"-120px", animation:"drift1 12s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 16s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(196,181,253,0.05) 0%, transparent 70%)", top:"40%", right:"20%", animation:"drift1 20s ease-in-out infinite reverse", pointerEvents:"none" }} />

      {/* Logo + spinner */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:28, animation:"fadeIn 0.6s ease forwards" }}>

        {/* Logo mark with pulse ring */}
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {/* Outer pulse ring */}
          <div style={{ position:"absolute", width:80, height:80, borderRadius:"50%", border:"1.5px solid rgba(124,110,250,0.25)", animation:"pulse-ring 2.4s ease-in-out infinite" }} />
          {/* Inner logo */}
          <div style={{
            width: 56, height: 56,
            background: "linear-gradient(135deg, #7C6EFA, #A78BFA)",
            borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(124,110,250,0.4)",
          }}>
            {/* Message bubble icon - inline SVG so no import needed */}
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white" />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div style={{ textAlign:"center" }}>
          <p style={{ margin:0, fontSize:22, fontWeight:700, color:"white", letterSpacing:"-0.5px" }}>ConnectX</p>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"#4B5563" }}>Private messaging for your crew</p>
        </div>

        {/* Spinner */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
          <div style={{
            width: 28, height: 28,
            borderRadius: "50%",
            border: "2px solid rgba(124,110,250,0.15)",
            borderTopColor: "#7C6EFA",
            animation: "spin 0.75s linear infinite",
          }} />
          <p style={{ margin:0, fontSize:12, color:"#374151", letterSpacing:"0.3px" }}>
            Signing you in{".".repeat(dot)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const migrateAvatarIfNeeded = async (userId: string, avatarUrl: string | null) => {
    if (!avatarUrl || !avatarUrl.includes("googleusercontent.com")) {
      return avatarUrl;
    }
    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();
      const fileName = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;
      await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", userId);
      return newUrl;
    } catch (err) {
      console.error("Avatar migration failed:", err);
      return avatarUrl;
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);

    const migratedUrl = await migrateAvatarIfNeeded(userId, data.avatar_url);
    if (migratedUrl !== data.avatar_url) {
      setProfile((prev: any) => (prev ? { ...prev, avatar_url: migratedUrl } : prev));
    }
  };

  if (loading) return <AppLoader />;

  const needsSetup = user && profile && profile.username?.includes("@");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/setup" element={user ? <SetupProfile /> : <Navigate to="/login" />} />
        <Route path="/" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <Home />} />
        <Route path="/profile" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <Profile />} />
        <Route path="/friends" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <Friends />} />
        <Route path="/chat/:id" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <Chat />} />
        <Route path="/stickers" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <Stickers />} />
        <Route path="/stickers/create" element={!user ? <Navigate to="/login" /> : needsSetup ? <Navigate to="/setup" /> : <CreateSticker />} />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;