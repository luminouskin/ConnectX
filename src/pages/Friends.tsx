import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Search,
  UserPlus,
  MessageCircle,
  UserMinus,
  Check,
  X,
  Clock,
  UserCheck,
} from "lucide-react";

export default function Friends() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");
  const navigate = useNavigate();

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUserId(session.user.id);
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setMyProfile(profile);
    loadFriendships(session.user.id);
  };

  const loadFriendships = async (userId: string) => {
    const { data: accepted } = await supabase
      .from("friendships")
      .select("*, sender:profiles!friendships_sender_id_fkey(*), receiver:profiles!friendships_receiver_id_fkey(*)")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friendsList = (accepted || []).map((f: any) => f.sender_id === userId ? f.receiver : f.sender);
    setFriends(friendsList);

    const { data: received } = await supabase
      .from("friendships")
      .select("*, sender:profiles!friendships_sender_id_fkey(*)")
      .eq("status", "pending").eq("receiver_id", userId);
    setPendingReceived(received || []);

    const { data: sent } = await supabase
      .from("friendships")
      .select("*, receiver:profiles!friendships_receiver_id_fkey(*)")
      .eq("status", "pending").eq("sender_id", userId);
    setPendingSent(sent || []);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const { data, error } = await supabase
      .from("profiles").select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", currentUserId).limit(10);
    if (error) console.error("Search error:", error.message);
    setSearchResults(data || []);
  };

  const sendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("friendships").insert({ sender_id: currentUserId, receiver_id: receiverId, status: "pending" });
    if (!error) {
      await supabase.from("notifications").insert({ user_id: receiverId, type: "friend_request", title: "New friend request", body: `${myProfile?.display_name || "Someone"} sent you a friend request`, data: { sender_id: currentUserId } });
      loadFriendships(currentUserId);
      handleSearch(searchQuery);
    }
  };

  const acceptRequest = async (friendshipId: string, senderId: string) => {
    if (!currentUserId) return;
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
    await supabase.from("notifications").insert({ user_id: senderId, type: "friend_accepted", title: "Friend request accepted", body: `${myProfile?.display_name || "Someone"} accepted your friend request`, data: { accepter_id: currentUserId } });
    loadFriendships(currentUserId);
  };

  const rejectRequest = async (friendshipId: string) => {
    if (!currentUserId) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadFriendships(currentUserId);
  };

  const cancelRequest = async (friendshipId: string) => {
    if (!currentUserId) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadFriendships(currentUserId);
  };

  const removeFriend = async (friendshipUserId: string) => {
    if (!currentUserId) return;
    await supabase.from("friendships").delete().or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${friendshipUserId}),and(sender_id.eq.${friendshipUserId},receiver_id.eq.${currentUserId})`);
    loadFriendships(currentUserId);
  };

  const getRequestStatus = (profileId: string) => {
    if (friends.some((f) => f.id === profileId)) return "friends";
    if (pendingSent.some((p) => p.receiver.id === profileId)) return "sent";
    if (pendingReceived.some((p) => p.sender.id === profileId)) return "received";
    return "none";
  };

  const startChat = async (friendId: string) => {
    if (!currentUserId) return;
    const { data: myConvos } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", currentUserId);
    for (const convo of myConvos || []) {
      const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", convo.conversation_id);
      const userIds = (members || []).map((m: any) => m.user_id);
      if (userIds.includes(friendId) && userIds.length === 2) { navigate(`/chat/${convo.conversation_id}`); return; }
    }
    console.error("No conversation found for this friend - they may have been friends before the auto-create trigger was set up.");
    showFallbackMessage();
  };

  const showFallbackMessage = () => {
    alert("Couldn't find a conversation with this friend. Try removing and re-adding them as a friend to refresh the connection.");
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const tabs = [
    { key: "friends", label: "Friends", count: friends.length, icon: Users },
    { key: "requests", label: "Requests", count: pendingReceived.length, icon: UserPlus },
    { key: "search", label: "Find People", count: 0, icon: Search },
  ];

  const Avatar = ({ url, name, size = 44 }: { url?: string; name: string; size?: number }) => (
    url ? (
      <img src={url} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "block" }} />
    ) : (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#7C6EFA,#A78BFA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.33, fontWeight: 600, flexShrink: 0 }}>
        {getInitials(name)}
      </div>
    )
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080B14", color: "white", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(124,110,250,0.2); border-radius: 99px; }
        input::placeholder { color: #374151; }
        .search-wrap:focus-within { border-color: rgba(124,110,250,0.5) !important; box-shadow: 0 0 0 3px rgba(124,110,250,0.1) !important; }
        .card-row { transition: background 0.18s ease, border-color 0.18s ease; }
        .card-row:hover { background: rgba(124,110,250,0.06) !important; border-color: rgba(124,110,250,0.15) !important; }
        .btn-msg { transition: all 0.18s ease; }
        .btn-msg:hover { background: rgba(124,110,250,0.2) !important; box-shadow: 0 0 16px rgba(124,110,250,0.2) !important; }
        .btn-remove { transition: all 0.18s ease; }
        .btn-remove:hover { background: rgba(239,68,68,0.15) !important; color: #F87171 !important; border-color: rgba(239,68,68,0.3) !important; }
        .btn-accept { transition: all 0.18s ease; }
        .btn-accept:hover { box-shadow: 0 4px 16px rgba(52,211,153,0.3) !important; transform: translateY(-1px); }
        .btn-reject { transition: all 0.18s ease; }
        .btn-reject:hover { background: rgba(239,68,68,0.15) !important; border-color: rgba(239,68,68,0.3) !important; color: #F87171 !important; }
        .btn-cancel { transition: all 0.18s ease; }
        .btn-cancel:hover { background: rgba(255,255,255,0.06) !important; }
        .btn-add { transition: all 0.18s ease; }
        .btn-add:hover { box-shadow: 0 4px 16px rgba(124,110,250,0.35) !important; transform: translateY(-1px); }
      `}</style>

      {/* Orbs */}
      <div style={{ position:"fixed", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.08) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"drift1 14s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 18s ease-in-out infinite", pointerEvents:"none", zIndex:0 }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 40px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22,1,0.36,1] }}
          style={{ display:"flex", alignItems:"center", gap:14, padding:"28px 0 24px" }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/")}
            style={{ width:38, height:38, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0 }}
          >
            <ArrowLeft size={17} />
          </motion.button>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700, letterSpacing:"-0.4px" }}>Friends</h1>
            <p style={{ margin:0, fontSize:12, color:"#4B5563", marginTop:2 }}>
              {friends.length} friend{friends.length !== 1 ? "s" : ""}
              {pendingReceived.length > 0 && ` · ${pendingReceived.length} pending request${pendingReceived.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity:0, y:8 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.1, duration:0.4 }}
          style={{ display:"flex", gap:6, marginBottom:24, background:"rgba(13,17,23,0.8)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:5 }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  flex:1, padding:"9px 8px",
                  background: isActive ? "rgba(124,110,250,0.18)" : "transparent",
                  color: isActive ? "#A78BFA" : "#4B5563",
                  border: isActive ? "1px solid rgba(124,110,250,0.25)" : "1px solid transparent",
                  borderRadius:10, cursor:"pointer",
                  fontSize:13, fontWeight: isActive ? 600 : 400,
                  fontFamily:"'Inter',sans-serif",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  transition:"all 0.2s ease",
                  whiteSpace:"nowrap",
                }}
              >
                <Icon size={14} />
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ background: isActive ? "#7C6EFA" : "rgba(124,110,250,0.3)", color:"white", fontSize:10, fontWeight:700, borderRadius:999, padding:"1px 6px", minWidth:16, textAlign:"center" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        <AnimatePresence mode="wait">

          {/* ── FRIENDS TAB ── */}
          {activeTab === "friends" && (
            <motion.div key="friends" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.25 }}>
              {friends.length === 0 ? (
                <div style={{ textAlign:"center", padding:"60px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                  <div style={{ width:60, height:60, borderRadius:18, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Users size={26} color="#7C6EFA" />
                  </div>
                  <p style={{ fontSize:15, fontWeight:600, margin:0 }}>No friends yet</p>
                  <p style={{ fontSize:13, color:"#4B5563", margin:0 }}>Search for people to connect with</p>
                  <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={() => setActiveTab("search")}
                    style={{ marginTop:4, padding:"9px 20px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 16px rgba(124,110,250,0.3)" }}>
                    Find people
                  </motion.button>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {friends.map((f, i) => (
                    <motion.div key={f.id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.06, duration:0.3 }}
                      className="card-row"
                      style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(13,17,23,0.7)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px" }}>
                      <Avatar url={f.avatar_url} name={f.display_name} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:"0 0 2px", fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.display_name}</p>
                        <p style={{ margin:0, color:"#4B5563", fontSize:12 }}>@{f.username}</p>
                      </div>
                      <button onClick={() => startChat(f.id)} className="btn-msg"
                        style={{ padding:"7px 14px", background:"rgba(124,110,250,0.12)", color:"#A78BFA", border:"1px solid rgba(124,110,250,0.2)", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
                        <MessageCircle size={13} /> Message
                      </button>
                      <button onClick={() => removeFriend(f.id)} className="btn-remove"
                        style={{ width:34, height:34, background:"rgba(255,255,255,0.03)", color:"#4B5563", border:"1px solid rgba(255,255,255,0.06)", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <UserMinus size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── REQUESTS TAB ── */}
          {activeTab === "requests" && (
            <motion.div key="requests" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.25 }}>

              {/* Received */}
              <div style={{ marginBottom:28 }}>
                <p style={{ color:"#374151", fontSize:10, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase", margin:"0 0 10px" }}>
                  Received · {pendingReceived.length}
                </p>
                {pendingReceived.length === 0 ? (
                  <div style={{ padding:"20px 16px", background:"rgba(13,17,23,0.5)", border:"1px solid rgba(255,255,255,0.04)", borderRadius:14, textAlign:"center" }}>
                    <p style={{ color:"#374151", fontSize:13, margin:0 }}>No pending requests</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {pendingReceived.map((req, i) => (
                      <motion.div key={req.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07, duration:0.3 }}
                        className="card-row"
                        style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(13,17,23,0.7)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px" }}>
                        <Avatar url={req.sender.avatar_url} name={req.sender.display_name} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:"0 0 2px", fontWeight:600, fontSize:14 }}>{req.sender.display_name}</p>
                          <p style={{ margin:0, color:"#4B5563", fontSize:12 }}>@{req.sender.username}</p>
                        </div>
                        <button onClick={() => acceptRequest(req.id, req.sender.id)} className="btn-accept"
                          style={{ padding:"7px 14px", background:"rgba(52,211,153,0.12)", color:"#34D399", border:"1px solid rgba(52,211,153,0.2)", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
                          <Check size={13} /> Accept
                        </button>
                        <button onClick={() => rejectRequest(req.id)} className="btn-reject"
                          style={{ width:34, height:34, background:"rgba(255,255,255,0.03)", color:"#4B5563", border:"1px solid rgba(255,255,255,0.06)", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent */}
              <div>
                <p style={{ color:"#374151", fontSize:10, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase", margin:"0 0 10px" }}>
                  Sent · {pendingSent.length}
                </p>
                {pendingSent.length === 0 ? (
                  <div style={{ padding:"20px 16px", background:"rgba(13,17,23,0.5)", border:"1px solid rgba(255,255,255,0.04)", borderRadius:14, textAlign:"center" }}>
                    <p style={{ color:"#374151", fontSize:13, margin:0 }}>No sent requests</p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {pendingSent.map((req, i) => (
                      <motion.div key={req.id} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay: i * 0.07, duration:0.3 }}
                        className="card-row"
                        style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(13,17,23,0.7)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px" }}>
                        <Avatar url={req.receiver.avatar_url} name={req.receiver.display_name} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:"0 0 2px", fontWeight:600, fontSize:14 }}>{req.receiver.display_name}</p>
                          <p style={{ margin:0, color:"#4B5563", fontSize:12 }}>@{req.receiver.username}</p>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6, color:"#4B5563", fontSize:12 }}>
                          <Clock size={12} /> Pending
                        </div>
                        <button onClick={() => cancelRequest(req.id)} className="btn-cancel"
                          style={{ width:34, height:34, background:"rgba(255,255,255,0.03)", color:"#4B5563", border:"1px solid rgba(255,255,255,0.06)", borderRadius:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SEARCH TAB ── */}
          {activeTab === "search" && (
            <motion.div key="search" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }} transition={{ duration:0.25 }}>

              {/* Search input */}
              <div className="search-wrap"
                style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(13,17,23,0.8)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"11px 14px", marginBottom:20, transition:"border-color 0.2s ease, box-shadow 0.2s ease" }}>
                <Search size={15} color="#4B5563" style={{ flexShrink:0 }} />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by username or name..."
                  style={{ background:"transparent", border:"none", color:"white", fontSize:14, outline:"none", flex:1, fontFamily:"'Inter',sans-serif" }}
                />
              </div>

              {/* Empty prompt */}
              {!searchQuery && (
                <div style={{ textAlign:"center", padding:"40px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                  <div style={{ width:52, height:52, borderRadius:16, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Search size={22} color="#7C6EFA" />
                  </div>
                  <p style={{ fontSize:14, color:"#4B5563", margin:0 }}>Type a name or username to search</p>
                </div>
              )}

              {/* Results */}
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <AnimatePresence>
                  {searchResults.map((p, i) => {
                    const status = getRequestStatus(p.id);
                    return (
                      <motion.div key={p.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, scale:0.97 }} transition={{ delay: i * 0.05, duration:0.25 }}
                        className="card-row"
                        style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(13,17,23,0.7)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, padding:"12px 14px" }}>
                        <Avatar url={p.avatar_url} name={p.display_name} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:"0 0 2px", fontWeight:600, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.display_name}</p>
                          <p style={{ margin:0, color:"#4B5563", fontSize:12 }}>@{p.username}</p>
                        </div>

                        {status === "none" && (
                          <button onClick={() => sendRequest(p.id)} className="btn-add"
                            style={{ padding:"7px 14px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", boxShadow:"0 4px 12px rgba(124,110,250,0.25)" }}>
                            <UserPlus size={13} /> Add
                          </button>
                        )}
                        {status === "sent" && (
                          <span style={{ display:"flex", alignItems:"center", gap:5, color:"#4B5563", fontSize:12 }}>
                            <Clock size={12} /> Sent
                          </span>
                        )}
                        {status === "received" && (
                          <span style={{ display:"flex", alignItems:"center", gap:5, color:"#A78BFA", fontSize:12, fontWeight:500 }}>
                            <UserPlus size={12} /> Check requests
                          </span>
                        )}
                        {status === "friends" && (
                          <span style={{ display:"flex", alignItems:"center", gap:5, color:"#34D399", fontSize:12, fontWeight:500 }}>
                            <UserCheck size={13} /> Friends
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {searchQuery.length >= 2 && searchResults.length === 0 && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:"center", padding:"32px 0", color:"#374151", fontSize:13 }}>
                    No users found for "{searchQuery}"
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}