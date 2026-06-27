import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Star, Clock, Grid3x3, Trash2, Sticker } from "lucide-react";

export default function Stickers() {
  const navigate = useNavigate();
  const [stickers, setStickers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"my" | "recent" | "favorites">("my");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadStickers(); }, []);

  const loadStickers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("stickers").select("*").eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setStickers(data || []);
    setLoading(false);
  };

  const toggleFavorite = async (stickerId: string, current: boolean) => {
    await supabase.from("stickers").update({ favorited: !current }).eq("id", stickerId);
    setStickers((prev) => prev.map((s) => (s.id === stickerId ? { ...s, favorited: !current } : s)));
  };

  const deleteSticker = async (sticker: any) => {
    setDeletingId(sticker.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const urlParts = sticker.url.split("/stickers/");
    const filePath = urlParts[1];
    await supabase.storage.from("stickers").remove([filePath]);
    await supabase.from("stickers").delete().eq("id", sticker.id);
    setStickers((prev) => prev.filter((s) => s.id !== sticker.id));
    setDeletingId(null);
  };

  const filteredStickers =
    activeTab === "favorites"
      ? stickers.filter((s) => s.favorited)
      : activeTab === "recent"
      ? [...stickers].sort((a, b) => (b.used_at || "").localeCompare(a.used_at || "")).slice(0, 20)
      : stickers;

  const tabs = [
    { key: "my", label: "My Stickers", icon: Grid3x3, count: stickers.length },
    { key: "recent", label: "Recent", icon: Clock, count: 0 },
    { key: "favorites", label: "Favorites", icon: Star, count: stickers.filter((s) => s.favorited).length },
  ];

  const emptyMessages: Record<string, string> = {
    favorites: "No favorites yet — star the ones you love",
    recent: "No recently used stickers",
    my: "No stickers yet — create your first one!",
  };

  return (
    <div style={{ height:"100vh", background:"#080B14", color:"white", display:"flex", flexDirection:"column", fontFamily:"'Inter',sans-serif", overflow:"hidden", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,110,250,0.2); border-radius: 99px; }
        .sticker-card { transition: transform 0.18s ease, border-color 0.18s ease; }
        .sticker-card:hover { transform: scale(1.04); border-color: rgba(124,110,250,0.3) !important; }
        .fav-btn { transition: all 0.18s ease; }
        .fav-btn:hover { background: rgba(0,0,0,0.75) !important; transform: scale(1.1); }
        .del-btn { transition: all 0.18s ease; opacity: 0; }
        .sticker-card:hover .del-btn { opacity: 1; }
        .del-btn:hover { background: rgba(239,68,68,0.95) !important; transform: scale(1.1); }
        .new-btn { transition: all 0.2s ease; }
        .new-btn:hover { box-shadow: 0 6px 24px rgba(124,110,250,0.4) !important; transform: translateY(-1px); }
        .new-btn:active { transform: translateY(0); }
      `}</style>

      {/* Orbs */}
      <div style={{ position:"fixed", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.07) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"drift1 14s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 18s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity:0, y:-12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4, ease:[0.22,1,0.36,1] }}
        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"rgba(13,17,23,0.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(124,110,250,0.08)", flexShrink:0, position:"relative", zIndex:2 }}
      >
        <motion.button
          whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          onClick={() => navigate("/")}
          style={{ width:36, height:36, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0 }}
        >
          <ArrowLeft size={16} />
        </motion.button>

        <div style={{ flex:1 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, letterSpacing:"-0.3px" }}>Sticker Pack</h2>
          <p style={{ margin:0, fontSize:11, color:"#4B5563", marginTop:1 }}>
            {stickers.length} sticker{stickers.length !== 1 ? "s" : ""} · {stickers.filter(s => s.favorited).length} favorited
          </p>
        </div>

        <motion.button
          whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
          onClick={() => navigate("/stickers/create")}
          className="new-btn"
          style={{ padding:"8px 16px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:7, boxShadow:"0 4px 16px rgba(124,110,250,0.3)" }}
        >
          <Plus size={14} />
          New
        </motion.button>
      </motion.div>

      {/* ── TABS ── */}
      <motion.div
        initial={{ opacity:0, y:8 }}
        animate={{ opacity:1, y:0 }}
        transition={{ delay:0.1, duration:0.35 }}
        style={{ display:"flex", gap:6, padding:"14px 20px 0", background:"rgba(8,11,20,0.5)", backdropFilter:"blur(12px)", flexShrink:0, position:"relative", zIndex:1 }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding:"8px 14px",
                background: isActive ? "rgba(124,110,250,0.16)" : "transparent",
                color: isActive ? "#A78BFA" : "#4B5563",
                border: isActive ? "1px solid rgba(124,110,250,0.25)" : "1px solid transparent",
                borderRadius:10, cursor:"pointer",
                fontSize:12, fontWeight: isActive ? 600 : 400,
                fontFamily:"'Inter',sans-serif",
                display:"flex", alignItems:"center", gap:6,
                transition:"all 0.2s ease",
              }}
            >
              <Icon size={13} />
              {tab.label}
              {tab.count > 0 && (
                <span style={{ background: isActive ? "#7C6EFA" : "rgba(255,255,255,0.08)", color: isActive ? "white" : "#6B7280", fontSize:10, fontWeight:700, borderRadius:99, padding:"1px 6px" }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* ── CONTENT ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 24px", position:"relative", zIndex:1 }}>

        {/* Skeleton loading */}
        {loading && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(100px, 1fr))", gap:12 }}>
            {[1,2,3,4,5,6,7,8].map((i) => (
              <div key={i} style={{ aspectRatio:"1", borderRadius:14, background:"rgba(255,255,255,0.04)", animation:"pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {/* Empty state */}
        <AnimatePresence mode="wait">
          {!loading && filteredStickers.length === 0 && (
            <motion.div
              key={activeTab + "-empty"}
              initial={{ opacity:0, y:16 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }}
              transition={{ duration:0.35 }}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", gap:14 }}
            >
              <div style={{ width:64, height:64, borderRadius:20, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {activeTab === "favorites" ? <Star size={26} color="#7C6EFA" /> : activeTab === "recent" ? <Clock size={26} color="#7C6EFA" /> : <Sticker size={26} color="#7C6EFA" />}
              </div>
              <p style={{ fontSize:15, fontWeight:600, margin:0 }}>
                {activeTab === "favorites" ? "No favorites yet" : activeTab === "recent" ? "No recent stickers" : "No stickers yet"}
              </p>
              <p style={{ fontSize:13, color:"#4B5563", margin:0, textAlign:"center", lineHeight:1.6 }}>
                {emptyMessages[activeTab]}
              </p>
              {activeTab === "my" && (
                <motion.button
                  whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                  onClick={() => navigate("/stickers/create")}
                  style={{ marginTop:4, padding:"10px 22px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 16px rgba(124,110,250,0.3)", display:"flex", alignItems:"center", gap:8 }}
                >
                  <Plus size={14} />
                  Create your first sticker
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticker grid */}
        {!loading && filteredStickers.length > 0 && (
          <motion.div
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            transition={{ duration:0.3 }}
            style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(100px, 1fr))", gap:12 }}
          >
            <AnimatePresence>
              {filteredStickers.map((sticker, i) => (
                <motion.div
                  key={sticker.id}
                  initial={{ opacity:0, scale:0.88 }}
                  animate={{ opacity: deletingId === sticker.id ? 0.4 : 1, scale:1 }}
                  exit={{ opacity:0, scale:0.8 }}
                  transition={{ delay: i * 0.03, duration:0.25, ease:[0.22,1,0.36,1] }}
                  className="sticker-card"
                  style={{ position:"relative", background:"rgba(13,17,23,0.8)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:8, aspectRatio:"1", overflow:"hidden" }}
                >
                  <img
                    src={sticker.thumbnail_url || sticker.url}
                    alt="sticker"
                    style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:8, display:"block" }}
                  />

                  {/* Favorite btn */}
                  <button
                    onClick={() => toggleFavorite(sticker.id, sticker.favorited)}
                    className="fav-btn"
                    style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.55)", backdropFilter:"blur(8px)", border:"none", borderRadius:"50%", width:26, height:26, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                  >
                    <Star
                      size={12}
                      color={sticker.favorited ? "#FBBF24" : "#6B7280"}
                      fill={sticker.favorited ? "#FBBF24" : "none"}
                    />
                  </button>

                  {/* Delete btn — only visible on hover via CSS */}
                  <button
                    onClick={() => deleteSticker(sticker)}
                    className="del-btn"
                    style={{ position:"absolute", bottom:6, right:6, background:"rgba(239,68,68,0.8)", backdropFilter:"blur(8px)", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
                  >
                    <Trash2 size={11} color="white" />
                  </button>

                  {/* Favorited glow overlay */}
                  {sticker.favorited && (
                    <div style={{ position:"absolute", inset:0, borderRadius:14, border:"1.5px solid rgba(251,191,36,0.3)", pointerEvents:"none" }} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}