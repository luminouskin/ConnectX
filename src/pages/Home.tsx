import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Users,
  Sticker,
  Settings,
  LogOut,
  Search,
  ChevronRight,
} from "lucide-react";

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState("/");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const reloadTimer = useRef<any>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let isActive = true;
    let channel: any = null;

    const setup = async () => {
      const ch = await init();
      if (isActive) {
        channel = ch;
      } else if (ch) {
        supabase.removeChannel(ch);
      }
    };

    setup();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) loadConversations(session.user.id);
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadConversations(session.user.id);
    });
  }, [navigate]);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data);
    loadConversations(session.user.id);
    loadPendingRequestCount(session.user.id);

    const channel = supabase
      .channel(`home-updates-${session.user.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `receiver_id=eq.${session.user.id}` },
        () => { loadPendingRequestCount(session.user.id); }
      )
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => loadConversations(session.user.id), 800);
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        () => {
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => loadConversations(session.user.id), 800);
        }
      )
      .subscribe();

    return channel;
  };

  const loadPendingRequestCount = async (userId: string) => {
    const { count } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("status", "pending");
    setPendingRequestCount(count || 0);
  };

  const loadConversations = async (userId: string) => {
    const { data: myMemberships } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId);

    const convoIds = (myMemberships || []).map((m: any) => m.conversation_id);

    if (convoIds.length === 0) {
      setConversations([]);
      setLoadingChats(false);
      return;
    }

    const results = await Promise.all(
      convoIds.map(async (convoId: string) => {
        const membership = myMemberships?.find((m: any) => m.conversation_id === convoId);

        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id, profiles(*)")
          .eq("conversation_id", convoId);

        const other = (members || []).find((m: any) => m.user_id !== userId);

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", convoId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastReadAt = membership?.last_read_at || "1970-01-01";
        const { count: unreadCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convoId)
          .neq("sender_id", userId)
          .gt("created_at", lastReadAt);

        return {
          conversationId: convoId,
          otherUser: other?.profiles || null,
          lastMessage: lastMsg,
          unreadCount: unreadCount || 0,
        };
      })
    );

    results.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || "0";
      const bTime = b.lastMessage?.created_at || "0";
      return bTime.localeCompare(aTime);
    });

    setConversations(results);
    setLoadingChats(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { icon: MessageCircle, label: "Chats", path: "/", badge: 0 },
    { icon: Users, label: "Friends", path: "/friends", badge: pendingRequestCount },
    { icon: Sticker, label: "Stickers", path: "/stickers", badge: 0 },
    { icon: Settings, label: "Settings", path: "/profile", badge: 0 },
  ];

  const filteredConversations = conversations.filter((c) =>
    c.otherUser?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.otherUser?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div style={{
      height: "100vh",
      background: "#080B14",
      color: "white",
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(0.85)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,110,250,0.2); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(124,110,250,0.4); }
        input::placeholder { color: #374151; }
        .nav-btn { transition: all 0.2s ease; }
        .nav-btn:hover { background: rgba(124,110,250,0.08) !important; }
        .chat-row { transition: background 0.18s ease; }
        .chat-row:hover { background: rgba(124,110,250,0.06) !important; }
        .logout-btn { transition: all 0.2s ease; }
        .logout-btn:hover { background: rgba(239,68,68,0.12) !important; color: #F87171 !important; }
        .search-wrap:focus-within { border-color: rgba(124,110,250,0.5) !important; box-shadow: 0 0 0 3px rgba(124,110,250,0.1) !important; }
        .bottom-nav-btn { transition: all 0.2s ease; }
        @media (max-width: 480px) {
          .header-title { font-size: 18px !important; }
        }
      `}</style>

      {/* Ambient orbs */}
      <div style={{ position:"absolute", width: isMobile ? 350 : 600, height: isMobile ? 350 : 600, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.07) 0%, transparent 70%)", top:"-150px", left:"-50px", animation:"drift1 14s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"absolute", width: isMobile ? 240 : 400, height: isMobile ? 240 : 400, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 70%)", bottom:"-100px", right:"10%", animation:"drift2 18s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />

      {/* ── DESKTOP SIDEBAR ── */}
      {!isMobile && (
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 260,
            background: "rgba(13,17,23,0.9)",
            backdropFilter: "blur(20px)",
            borderRight: "1px solid rgba(124,110,250,0.1)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 12px",
            gap: 4,
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div style={{ padding: "8px 10px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg, #7C6EFA, #A78BFA)",
              borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(124,110,250,0.3)",
              flexShrink: 0,
            }}>
              <MessageCircle size={16} color="white" fill="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>ConnectX</span>
          </div>

          {/* Profile card */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate("/profile")}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "rgba(124,110,250,0.08)",
              border: "1px solid rgba(124,110,250,0.12)",
              borderRadius: 12,
              cursor: "pointer",
              marginBottom: 8,
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(124,110,250,0.4)", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                {getInitials(profile?.display_name || "")}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{profile?.display_name || "..."}</p>
              <p style={{ margin: 0, color: "#6B7280", fontSize: 11 }}>@{profile?.username || "..."}</p>
            </div>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399", animation: "pulse-dot 2.5s ease-in-out infinite", flexShrink: 0 }} />
          </motion.div>

          {/* Nav label */}
          <p style={{ color: "#374151", fontSize: 10, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 12px 2px", margin: 0 }}>Menu</p>

          {/* Nav items */}
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = activeNav === item.path;
            return (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.07, duration: 0.35 }}
                onClick={() => { setActiveNav(item.path); navigate(item.path); }}
                className="nav-btn"
                style={{
                  padding: "10px 12px",
                  background: isActive ? "rgba(124,110,250,0.14)" : "transparent",
                  color: isActive ? "#A78BFA" : "#9CA3AF",
                  border: isActive ? "1px solid rgba(124,110,250,0.2)" : "1px solid transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "'Inter', sans-serif",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ display:"flex", alignItems:"center", gap: 10 }}>
                  <Icon size={16} />
                  {item.label}
                </span>
                {item.badge > 0 && (
                  <span style={{ background: "#7C6EFA", color: "white", fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "2px 6px", minWidth: 16, textAlign: "center" }}>
                    {item.badge}
                  </span>
                )}
              </motion.button>
            );
          })}

          <div style={{ flex: 1 }} />

          {/* Logout */}
          <button
            onClick={logout}
            className="logout-btn"
            style={{
              padding: "10px 12px",
              background: "transparent",
              color: "#6B7280",
              border: "1px solid rgba(239,68,68,0.1)",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </motion.div>
      )}

      {/* ── MAIN PANEL ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1, minHeight: 0 }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            padding: isMobile ? "14px 14px 10px" : "16px 16px 12px",
            borderBottom: "1px solid rgba(124,110,250,0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "rgba(8,11,20,0.6)",
            backdropFilter: "blur(12px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap: 10 }}>
            {isMobile && (
              <div style={{
                width: 30, height: 30,
                background: "linear-gradient(135deg, #7C6EFA, #A78BFA)",
                borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(124,110,250,0.3)",
                flexShrink: 0,
              }}>
                <MessageCircle size={15} color="white" fill="white" />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="header-title" style={{ margin: 0, fontSize: isMobile ? 19 : 20, fontWeight: 700, letterSpacing: "-0.4px" }}>Messages</h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4B5563" }}>
                {conversations.length > 0 ? `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}` : "No conversations yet"}
              </p>
            </div>

            {isMobile && (
              <motion.div
                whileTap={{ scale: 0.93 }}
                onClick={() => navigate("/profile")}
                style={{ flexShrink: 0, cursor: "pointer", position: "relative" }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(124,110,250,0.4)" }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: 12, fontWeight: 600 }}>
                    {getInitials(profile?.display_name || "")}
                  </div>
                )}
                <div style={{ position:"absolute", bottom:-1, right:-1, width: 9, height: 9, borderRadius:"50%", background:"#34D399", border:"2px solid #080B14" }} />
              </motion.div>
            )}
          </div>

          {/* Search */}
          <div
            className="search-wrap"
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(13,17,23,0.8)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10, padding: "9px 14px",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <Search size={14} color="#4B5563" style={{ flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              style={{ background:"transparent", border:"none", color:"white", fontSize:13, outline:"none", flex:1, fontFamily:"'Inter',sans-serif", minWidth: 0 }}
            />
          </div>
        </motion.div>

        {/* Conversations list */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: isMobile ? 70 : 0 }}>

          {/* Loading */}
          {loadingChats && (
            <div style={{ display:"flex", flexDirection:"column", gap:1, padding:"8px 0" }}>
              {[1,2,3,4].map((i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap: isMobile ? 12 : 14, padding: isMobile ? "12px 14px" : "14px 24px" }}>
                  <div style={{ width: isMobile ? 44 : 48, height: isMobile ? 44 : 48, borderRadius:"50%", background:"rgba(255,255,255,0.04)", flexShrink:0, animation:"pulse-dot 1.5s ease-in-out infinite" }} />
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ height:13, width:"40%", background:"rgba(255,255,255,0.04)", borderRadius:6, animation:"pulse-dot 1.5s ease-in-out infinite" }} />
                    <div style={{ height:11, width:"65%", background:"rgba(255,255,255,0.03)", borderRadius:6, animation:"pulse-dot 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loadingChats && conversations.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"70%", gap:12, padding: "0 24px" }}
            >
              <div style={{ width:64, height:64, borderRadius:20, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:4 }}>
                <MessageCircle size={28} color="#7C6EFA" />
              </div>
              <p style={{ fontSize:16, fontWeight:600, margin:0, color:"white" }}>No messages yet</p>
              <p style={{ fontSize:13, color:"#4B5563", margin:0, textAlign:"center", lineHeight:1.6 }}>Add friends and start your first conversation</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/friends")}
                style={{ padding:"10px 20px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif", marginTop:4, boxShadow:"0 4px 16px rgba(124,110,250,0.3)", display:"flex", alignItems:"center", gap:8 }}
              >
                <Users size={14} />
                Find friends
              </motion.button>
            </motion.div>
          )}

          {/* Chat rows */}
          <AnimatePresence>
            {!loadingChats && filteredConversations.map((c, i) => (
              <motion.div
                key={c.conversationId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                onClick={() => {
                  setConversations((prev) =>
                    prev.map((conv) =>
                      conv.conversationId === c.conversationId
                        ? { ...conv, unreadCount: 0 }
                        : conv
                    )
                  );
                  navigate(`/chat/${c.conversationId}`);
                }}
                className="chat-row"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: isMobile ? "11px 14px" : "11px 16px",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  position: "relative",
                }}
              >
                {/* Avatar */}
                <div style={{ position:"relative", flexShrink:0 }}>
                  {c.otherUser?.avatar_url ? (
                    <img src={c.otherUser.avatar_url} style={{ width: isMobile ? 46 : 48, height: isMobile ? 46 : 48, borderRadius:"50%", display:"block" }} />
                  ) : (
                    <div style={{ width: isMobile ? 46 : 48, height: isMobile ? 46 : 48, borderRadius:"50%", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:600 }}>
                      {getInitials(c.otherUser?.display_name || "?")}
                    </div>
                  )}
                  <div style={{ position:"absolute", bottom:1, right:1, width:10, height:10, borderRadius:"50%", background:"#34D399", border:"2px solid #080B14" }} />
                </div>

                {/* Text */}
                <div style={{ flex:1, minWidth:0, textAlign:"left" }}>
                  <p style={{ margin:"0 0 3px", fontWeight: c.unreadCount > 0 ? 700 : 500, fontSize: isMobile ? 13.5 : 14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", textAlign:"left" }}>
                    {c.otherUser?.display_name || "Unknown"}
                  </p>
                  <p style={{
                    margin:0,
                    color: c.unreadCount > 0 ? "#D1D5DB" : "#4B5563",
                    fontWeight: c.unreadCount > 0 ? 500 : 400,
                    fontSize:12,
                    whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    textAlign:"left",
                  }}>
                    {c.lastMessage?.content || "No messages yet"}
                  </p>
                </div>

                {/* Right side */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                  {c.lastMessage?.created_at && (
                    <p style={{ margin:0, color: c.unreadCount > 0 ? "#7C6EFA" : "#374151", fontSize:11, fontWeight: c.unreadCount > 0 ? 600 : 400 }}>
                      {formatTime(c.lastMessage.created_at)}
                    </p>
                  )}
                  {c.unreadCount > 0 ? (
                    <span style={{ background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", fontSize:10, fontWeight:700, borderRadius:999, padding:"2px 7px", minWidth:18, textAlign:"center", boxShadow:"0 2px 8px rgba(124,110,250,0.4)" }}>
                      {c.unreadCount}
                    </span>
                  ) : (
                    !isMobile && <ChevronRight size={13} color="#1F2937" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Search no results */}
          {!loadingChats && searchQuery && filteredConversations.length === 0 && (
            <motion.div
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              style={{ padding:"40px 24px", textAlign:"center", color:"#374151", fontSize:13 }}
            >
              No conversations matching "{searchQuery}"
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            bottom: 0, left: 0, right: 0,
            background: "rgba(13,17,23,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(124,110,250,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
            zIndex: 10,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.path;
            return (
              <button
                key={item.label}
                onClick={() => { setActiveNav(item.path); navigate(item.path); }}
                className="bottom-nav-btn"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 14px",
                  position: "relative",
                  flex: 1,
                }}
              >
                <div style={{ position: "relative" }}>
                  <Icon size={20} color={isActive ? "#A78BFA" : "#4B5563"} fill={isActive ? "rgba(124,110,250,0.15)" : "none"} />
                  {item.badge > 0 && (
                    <span style={{ position:"absolute", top:-4, right:-6, background:"#7C6EFA", color:"white", fontSize:9, fontWeight:700, borderRadius:99, padding:"1px 5px", minWidth:14, textAlign:"center", border:"1.5px solid #0D1117" }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? "#A78BFA" : "#4B5563" }}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Logout as part of bottom nav */}
          <button
            onClick={logout}
            style={{ background:"transparent", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"6px 14px", flex:1 }}
          >
            <LogOut size={20} color="#4B5563" />
            <span style={{ fontSize:10, color:"#4B5563" }}>Logout</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}