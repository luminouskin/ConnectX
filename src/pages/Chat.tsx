import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Smile,
  Sticker,
  Send,
  Check,
  Pencil,
  Trash2,
  Trash,
  Copy,
  Forward,
  Star,
  X,
  AlertTriangle,
} from "lucide-react";

export default function Chat() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFriends, setIsFriends] = useState(true);
  const [pickerTab, setPickerTab] = useState<"emoji" | "stickers" | null>(null);
  const [myStickers, setMyStickers] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{ msg: any; x: number; y: number } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState<any | null>(null);
  const [myConversations, setMyConversations] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
      if (isActive) channel = ch;
      else if (ch) supabase.removeChannel(ch);
    };
    setup();
    return () => {
      isActive = false;
      if (channel) { supabase.removeChannel(channel); channel = null; }
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const markAsRead = async (userId: string) => {
    if (!conversationId) return;
    await supabase.from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).eq("user_id", userId);
  };

  const checkFriendshipStatus = async (userId: string, otherUserId: string) => {
    const { data } = await supabase.from("friendships").select("status").eq("status", "accepted")
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .maybeSingle();
    setIsFriends(!!data);
  };

  const loadMyStickers = async (userId: string) => {
    const { data } = await supabase.from("stickers").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMyStickers(data || []);
  };

  const loadMyConversations = async (userId: string) => {
    const { data: memberships } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", userId);
    const ids = (memberships || []).map((m: any) => m.conversation_id).filter((id) => id !== conversationId);
    const results = await Promise.all(ids.map(async (id: string) => {
      const { data: members } = await supabase.from("conversation_members").select("user_id, profiles(*)").eq("conversation_id", id);
      const other = (members || []).find((m: any) => m.user_id !== userId);
      return { conversationId: id, otherUser: other?.profiles };
    }));
    setMyConversations(results);
  };

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !conversationId) return null;
    const userId = session.user.id;
    setCurrentUserId(userId);

    const { data: members } = await supabase.from("conversation_members").select("user_id, profiles(*)").eq("conversation_id", conversationId);
    const other = (members || []).find((m: any) => m.user_id !== userId);
    setOtherUser(other?.profiles || null);
    if (other?.user_id) await checkFriendshipStatus(userId, other.user_id);

    const { data: msgs } = await supabase.from("messages").select("*, sender:profiles(*)")
      .eq("conversation_id", conversationId).eq("deleted", false).order("created_at", { ascending: true });
    setMessages(msgs || []);
    setLoading(false);
    loadMyStickers(userId);
    loadMyConversations(userId);
    await markAsRead(userId);

    const channel = supabase.channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        if (payload.new.sender_id === userId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, { ...payload.new, sender: null, _needsSenderFetch: true }];
        });
        const { data: sender } = await supabase.from("profiles").select("*").eq("id", payload.new.sender_id).single();
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, sender, _needsSenderFetch: false } : m)));
        await markAsRead(userId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => payload.new.deleted ? prev.filter((m) => m.id !== payload.new.id) : prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        if (other?.user_id) checkFriendshipStatus(userId, other.user_id);
      })
      .subscribe();

    return channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !conversationId || !isFriends) return;

    if (editingMessage) {
      const content = newMessage.trim();
      setNewMessage(""); setEditingMessage(null);
      await supabase.from("messages").update({ content, edited: true }).eq("id", editingMessage.id);
      setMessages((prev) => prev.map((m) => (m.id === editingMessage.id ? { ...m, content, edited: true } : m)));
      return;
    }

    const content = newMessage.trim();
    setNewMessage("");
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, conversation_id: conversationId, sender_id: currentUserId, content, type: "text", created_at: new Date().toISOString(), sender: null, _pending: true }]);

    const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: currentUserId, content, type: "text" }).select().single();
    if (error) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _pending: false } : m)));
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data, sender: null, _pending: false } : m)));
  };

  const sendSticker = async (sticker: any) => {
    if (!currentUserId || !conversationId || !isFriends) return;
    setPickerTab(null);
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, conversation_id: conversationId, sender_id: currentUserId, content: null, media_url: sticker.url, type: "sticker", created_at: new Date().toISOString(), sender: null, _pending: true }]);
    const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: currentUserId, media_url: sticker.url, type: "sticker" }).select().single();
    await supabase.from("stickers").update({ used_at: new Date().toISOString() }).eq("id", sticker.id);
    if (error) { setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _pending: false } : m))); return; }
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...data, sender: null, _pending: false } : m)));
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const togglePicker = (tab: "emoji" | "stickers") => {
    setPickerTab((prev) => (prev === tab ? null : tab));
  };

  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: any) => {
    e.preventDefault(); e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    setContextMenu({ msg, x: point.clientX, y: point.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: any) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({ msg, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const copyMessage = (msg: any) => { navigator.clipboard.writeText(msg.content || ""); showToast("Copied to clipboard"); setContextMenu(null); };

  const deleteMessage = async (msg: any, forEveryone: boolean) => {
    setContextMenu(null);
    if (forEveryone) {
      await supabase.from("messages").update({ deleted: true }).eq("id", msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      showToast("Deleted for you");
    }
  };

  const startEdit = (msg: any) => { setEditingMessage(msg); setNewMessage(msg.content || ""); setContextMenu(null); };
  const cancelEdit = () => { setEditingMessage(null); setNewMessage(""); };

  const addStickerToCollection = async (msg: any) => {
    setContextMenu(null);
    if (!currentUserId) return;
    const { error } = await supabase.from("stickers").insert({ user_id: currentUserId, url: msg.media_url, thumbnail_url: msg.media_url });
    if (error) showToast("Failed to add sticker");
    else { showToast("Added to your stickers"); loadMyStickers(currentUserId); }
  };

  const forwardMessage = async (targetConversationId: string) => {
    const msg = showForwardPicker;
    setShowForwardPicker(null);
    if (!msg || !currentUserId) return;
    await supabase.from("messages").insert({ conversation_id: targetConversationId, sender_id: currentUserId, content: msg.content, media_url: msg.media_url, type: msg.type });
    showToast("Message forwarded");
  };

  const getInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  // ── LOADING ──
  if (loading) {
    return (
      <div style={{ height:"100vh", background:"#080B14", display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", gap:16, fontFamily:"'Inter',sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
        <div style={{ width:48, height:48, borderRadius:"50%", border:"2px solid rgba(124,110,250,0.2)", borderTopColor:"#7C6EFA", animation:"spin 0.8s linear infinite" }} />
        <p style={{ color:"#374151", fontSize:13, margin:0 }}>Loading chat...</p>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ height:"100vh", background:"#080B14", color:"white", display:"flex", flexDirection:"column", position:"relative", fontFamily:"'Inter',sans-serif", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.8)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(124,110,250,0.15);border-radius:99px}
        input::placeholder{color:#374151}
        .ctx-btn{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 14px;background:transparent;border:none;color:white;cursor:pointer;font-size:13px;font-family:'Inter',sans-serif;transition:background 0.15s ease}
        .ctx-btn:hover{background:rgba(124,110,250,0.1)}
        .ctx-btn-danger{color:#F87171}
        .ctx-btn-danger:hover{background:rgba(239,68,68,0.1) !important}
        .send-btn:hover{box-shadow:0 4px 20px rgba(124,110,250,0.45) !important;transform:scale(1.05)}
        .send-btn:active{transform:scale(0.95)}
        .sticker-item:hover{transform:scale(1.08);border-color:rgba(124,110,250,0.4) !important}
        .fwd-row:hover{background:rgba(124,110,250,0.07) !important}
      `}</style>

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity:0, y:-12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4, ease:[0.22,1,0.36,1] }}
        style={{ display:"flex", alignItems:"center", gap:12, padding: isMobile ? "12px 14px" : "14px 20px", background:"rgba(13,17,23,0.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(124,110,250,0.08)", flexShrink:0 }}
      >
        <motion.button
          whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          onClick={() => navigate("/")}
          style={{ width:36, height:36, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0 }}
        >
          <ArrowLeft size={16} />
        </motion.button>

        <div style={{ position:"relative", flexShrink:0 }}>
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} style={{ width:38, height:38, borderRadius:"50%", display:"block", border:"1.5px solid rgba(124,110,250,0.3)" }} />
          ) : (
            <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:600 }}>
              {getInitials(otherUser?.display_name || "?")}
            </div>
          )}
          <div style={{ position:"absolute", bottom:1, right:0, width:9, height:9, borderRadius:"50%", background:"#34D399", border:"2px solid #080B14", animation:"pulse-dot 2.5s ease-in-out infinite" }} />
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:0, fontWeight:600, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{otherUser?.display_name || "Unknown"}</p>
          <p style={{ margin:0, color:"#4B5563", fontSize:11 }}>@{otherUser?.username}</p>
        </div>
      </motion.div>

      {/* ── MESSAGES ── */}
      <div style={{ flex:1, overflowY:"auto", padding: isMobile ? "12px 12px" : "16px 20px", display:"flex", flexDirection:"column", gap:4 }}>
        {messages.length === 0 && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3 }}
            style={{ textAlign:"center", marginTop:60, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <div style={{ width:56, height:56, borderRadius:18, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Send size={22} color="#7C6EFA" />
            </div>
            <p style={{ color:"#374151", fontSize:14, margin:0 }}>Say hi to get the conversation started</p>
          </motion.div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.sender_id === currentUserId;
          const prevMsg = messages[i - 1];
          const showDateDivider = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

          return (
            <div key={msg.id}>
              {/* Date divider */}
              {showDateDivider && (
                <div style={{ display:"flex", alignItems:"center", gap:10, margin:"12px 0 8px" }}>
                  <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.04)" }} />
                  <span style={{ color:"#374151", fontSize:11, fontWeight:500, whiteSpace:"nowrap" }}>
                    {new Date(msg.created_at).toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" })}
                  </span>
                  <div style={{ flex:1, height:"1px", background:"rgba(255,255,255,0.04)" }} />
                </div>
              )}

              {/* Sticker */}
              {msg.type === "sticker" && (
                <motion.div
                  initial={{ opacity:0, scale:0.85, y:6 }}
                  animate={{ opacity: msg._pending ? 0.6 : 1, scale:1, y:0 }}
                  transition={{ duration:0.25, ease:[0.22,1,0.36,1] }}
                  onContextMenu={(e) => openContextMenu(e, msg)}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchEnd={handleTouchEnd}
                  style={{ alignSelf: isMine ? "flex-end" : "flex-start", display:"flex", justifyContent: isMine ? "flex-end" : "flex-start", marginTop:2, cursor:"pointer" }}
                >
                  <img src={msg.media_url} alt="sticker" style={{ width: isMobile ? 92 : 110, height: isMobile ? 92 : 110, objectFit:"cover", borderRadius:16, border: msg._failed ? "2px solid #F87171" : "1px solid rgba(255,255,255,0.06)" }} />
                </motion.div>
              )}

              {/* Text message */}
              {msg.type !== "sticker" && (
                <motion.div
                  initial={{ opacity:0, y:8, scale:0.97 }}
                  animate={{ opacity: msg._pending ? 0.7 : 1, y:0, scale:1 }}
                  transition={{ duration:0.22, ease:[0.22,1,0.36,1] }}
                  onContextMenu={(e) => openContextMenu(e, msg)}
                  onTouchStart={(e) => handleTouchStart(e, msg)}
                  onTouchEnd={handleTouchEnd}
                  style={{ display:"flex", justifyContent: isMine ? "flex-end" : "flex-start", marginTop:2 }}
                >
                  <div style={{
                    maxWidth: isMobile ? "82%" : "65%",
                    background: msg._failed
                      ? "rgba(239,68,68,0.15)"
                      : isMine
                      ? "linear-gradient(135deg,#7C6EFA,#6D5FF0)"
                      : "rgba(22,28,40,0.9)",
                    padding:"10px 14px",
                    borderRadius:18,
                    borderBottomRightRadius: isMine ? 4 : 18,
                    borderBottomLeftRadius: isMine ? 18 : 4,
                    border: msg._failed ? "1px solid rgba(239,68,68,0.3)" : isMine ? "none" : "1px solid rgba(255,255,255,0.05)",
                    boxShadow: isMine ? "0 2px 12px rgba(124,110,250,0.2)" : "none",
                    cursor:"pointer",
                  }}>
                    <p style={{ margin:0, fontSize:14, lineHeight:1.5, wordBreak:"break-word" }}>{msg.content}</p>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4, marginTop:4 }}>
                      {msg.edited && !msg._pending && !msg._failed && (
                        <span style={{ fontSize:10, color: isMine ? "rgba(255,255,255,0.45)" : "#374151" }}>edited</span>
                      )}
                      <span style={{ fontSize:10, color: isMine ? "rgba(255,255,255,0.45)" : "#374151" }}>
                        {msg._failed ? "Failed" : msg._pending ? "Sending…" : new Date(msg.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                      </span>
                      {isMine && !msg._pending && !msg._failed && (
                        <Check size={10} color="rgba(255,255,255,0.45)" />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── CONTEXT MENU ── */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity:0, scale:0.92 }}
            animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:0.92 }}
            transition={{ duration:0.15, ease:[0.22,1,0.36,1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position:"fixed",
              top: Math.min(contextMenu.y, window.innerHeight - 280),
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              background:"rgba(18,24,34,0.98)",
              backdropFilter:"blur(20px)",
              border:"1px solid rgba(124,110,250,0.15)",
              borderRadius:14,
              overflow:"hidden",
              zIndex:1000,
              minWidth:188,
              boxShadow:"0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset",
            }}
          >
            {contextMenu.msg.type === "text" && (
              <button className="ctx-btn" onClick={() => copyMessage(contextMenu.msg)}>
                <Copy size={14} /> Copy text
              </button>
            )}
            <button className="ctx-btn" onClick={() => { setShowForwardPicker(contextMenu.msg); setContextMenu(null); }}>
              <Forward size={14} /> Forward
            </button>
            {contextMenu.msg.type === "sticker" && contextMenu.msg.sender_id !== currentUserId && (
              <button className="ctx-btn" onClick={() => addStickerToCollection(contextMenu.msg)}>
                <Star size={14} /> Save sticker
              </button>
            )}
            {contextMenu.msg.sender_id === currentUserId && (
              <>
                {contextMenu.msg.type === "text" && (
                  <button className="ctx-btn" onClick={() => startEdit(contextMenu.msg)}>
                    <Pencil size={14} /> Edit message
                  </button>
                )}
                <div style={{ height:"1px", background:"rgba(255,255,255,0.05)", margin:"2px 0" }} />
                <button className="ctx-btn ctx-btn-danger" onClick={() => deleteMessage(contextMenu.msg, false)}>
                  <Trash size={14} /> Delete for me
                </button>
                <button className="ctx-btn ctx-btn-danger" onClick={() => deleteMessage(contextMenu.msg, true)}>
                  <Trash2 size={14} /> Delete for everyone
                </button>
              </>
            )}
            {contextMenu.msg.sender_id !== currentUserId && (
              <>
                <div style={{ height:"1px", background:"rgba(255,255,255,0.05)", margin:"2px 0" }} />
                <button className="ctx-btn ctx-btn-danger" onClick={() => deleteMessage(contextMenu.msg, false)}>
                  <Trash size={14} /> Delete for me
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FORWARD MODAL ── */}
      <AnimatePresence>
        {showForwardPicker && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setShowForwardPicker(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(6px)" }}
          >
            <motion.div
              initial={{ opacity:0, scale:0.93, y:16 }}
              animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.93, y:16 }}
              transition={{ duration:0.25, ease:[0.22,1,0.36,1] }}
              onClick={(e) => e.stopPropagation()}
              style={{ background:"rgba(13,17,23,0.98)", backdropFilter:"blur(24px)", border:"1px solid rgba(124,110,250,0.15)", borderRadius: isMobile ? 20 : 20, width: isMobile ? "calc(100vw - 40px)" : 320, maxWidth: 320, maxHeight:"60vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 32px 64px rgba(0,0,0,0.7)" }}
            >
              <div style={{ padding:"18px 20px 12px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <h3 style={{ margin:0, fontSize:15, fontWeight:700 }}>Forward to</h3>
                <button onClick={() => setShowForwardPicker(null)} style={{ background:"rgba(255,255,255,0.05)", border:"none", color:"#9CA3AF", width:28, height:28, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ overflowY:"auto", padding:"8px 10px 12px" }}>
                {myConversations.length === 0 ? (
                  <p style={{ color:"#374151", fontSize:13, textAlign:"center", padding:"24px 0", margin:0 }}>No other chats available</p>
                ) : (
                  myConversations.map((c) => (
                    <div key={c.conversationId} className="fwd-row" onClick={() => forwardMessage(c.conversationId)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"10px", cursor:"pointer", borderRadius:12, transition:"background 0.15s ease" }}>
                      {c.otherUser?.avatar_url ? (
                        <img src={c.otherUser.avatar_url} style={{ width:38, height:38, borderRadius:"50%", flexShrink:0 }} />
                      ) : (
                        <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:600, flexShrink:0 }}>
                          {getInitials(c.otherUser?.display_name || "?")}
                        </div>
                      )}
                      <p style={{ margin:0, fontSize:14, fontWeight:500 }}>{c.otherUser?.display_name}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity:0, y:12, scale:0.95 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:12, scale:0.95 }}
            transition={{ duration:0.2 }}
            style={{ position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"rgba(18,24,34,0.98)", backdropFilter:"blur(16px)", border:"1px solid rgba(124,110,250,0.2)", color:"white", padding:"9px 18px", borderRadius:99, fontSize:13, fontWeight:500, zIndex:1001, whiteSpace:"nowrap", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PICKER PANEL ── */}
      <AnimatePresence>
        {pickerTab && isFriends && (
          <motion.div
            initial={{ opacity:0, height:0 }}
            animate={{ opacity:1, height:"auto" }}
            exit={{ opacity:0, height:0 }}
            transition={{ duration:0.25, ease:[0.22,1,0.36,1] }}
            style={{ background:"rgba(13,17,23,0.98)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(124,110,250,0.1)", overflow:"hidden" }}
          >
            {/* Picker tabs */}
            <div style={{ display:"flex", gap:6, padding:"10px 16px 0" }}>
              {(["emoji","stickers"] as const).map((tab) => (
                <button key={tab} onClick={() => togglePicker(tab)}
                  style={{ padding:"7px 16px", background: pickerTab === tab ? "rgba(124,110,250,0.18)" : "transparent", color: pickerTab === tab ? "#A78BFA" : "#4B5563", border: pickerTab === tab ? "1px solid rgba(124,110,250,0.25)" : "1px solid transparent", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight: pickerTab === tab ? 600 : 400, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:6, transition:"all 0.2s ease" }}>
                  {tab === "emoji" ? <Smile size={13} /> : <Sticker size={13} />}
                  {tab === "emoji" ? "Emoji" : "Stickers"}
                </button>
              ))}
            </div>

            <div style={{ padding: pickerTab === "emoji" ? "8px 0 0" : "12px 16px 16px", maxHeight: isMobile ? 260 : 320, overflowY:"auto" }}>
              {pickerTab === "emoji" && (
                <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width="100%" height={300} searchDisabled={false} skinTonesDisabled={false} previewConfig={{ showPreview: false }} />
              )}
              {pickerTab === "stickers" && (
                myStickers.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"24px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                    <div style={{ width:44, height:44, borderRadius:14, background:"rgba(124,110,250,0.1)", border:"1px solid rgba(124,110,250,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Sticker size={20} color="#7C6EFA" />
                    </div>
                    <p style={{ color:"#374151", fontSize:13, margin:0 }}>No stickers yet</p>
                    <button onClick={() => navigate("/stickers/create")}
                      style={{ padding:"8px 18px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:9, cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Inter',sans-serif", boxShadow:"0 4px 12px rgba(124,110,250,0.25)" }}>
                      Create sticker
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(68px,1fr))", gap:8 }}>
                    {myStickers.map((sticker) => (
                      <img key={sticker.id} src={sticker.thumbnail_url || sticker.url} alt="sticker"
                        onClick={() => sendSticker(sticker)}
                        className="sticker-item"
                        style={{ width:"100%", aspectRatio:"1", objectFit:"cover", borderRadius:10, cursor:"pointer", border:"1px solid rgba(255,255,255,0.05)", transition:"transform 0.15s ease, border-color 0.15s ease" }}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT BANNER ── */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 20px", background:"rgba(124,110,250,0.1)", borderTop:"1px solid rgba(124,110,250,0.15)" }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8, color:"#A78BFA", fontSize:12, fontWeight:500 }}>
              <Pencil size={12} />
              Editing message
            </div>
            <button onClick={cancelEdit} style={{ background:"transparent", border:"none", color:"#F87171", cursor:"pointer", fontSize:12, fontWeight:500, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", gap:5 }}>
              <X size={12} /> Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NOT FRIENDS BANNER ── */}
      {!isFriends && (
        <div style={{ padding:"12px 20px", background:"rgba(239,68,68,0.08)", borderTop:"1px solid rgba(239,68,68,0.15)", display:"flex", alignItems:"center", gap:10 }}>
          <AlertTriangle size={14} color="#F87171" style={{ flexShrink:0 }} />
          <p style={{ margin:0, fontSize:13, color:"#F87171" }}>You're no longer friends — add them back to send messages</p>
        </div>
      )}

      {/* ── INPUT BAR ── */}
      <div style={{ display:"flex", gap:8, padding: isMobile ? "10px 10px calc(10px + env(safe-area-inset-bottom))" : "12px 16px", background:"rgba(13,17,23,0.98)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(124,110,250,0.08)", alignItems:"center", opacity: isFriends ? 1 : 0.45, flexShrink:0 }}>
        <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          onClick={() => isFriends && togglePicker("emoji")} disabled={!isFriends}
          style={{ width:38, height:38, background: pickerTab === "emoji" ? "rgba(124,110,250,0.18)" : "rgba(255,255,255,0.04)", border: pickerTab === "emoji" ? "1px solid rgba(124,110,250,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius:10, cursor: isFriends ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", color: pickerTab === "emoji" ? "#A78BFA" : "#4B5563", transition:"all 0.2s ease", flexShrink:0 }}>
          <Smile size={17} />
        </motion.button>

        <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          onClick={() => isFriends && togglePicker("stickers")} disabled={!isFriends}
          style={{ width:38, height:38, background: pickerTab === "stickers" ? "rgba(124,110,250,0.18)" : "rgba(255,255,255,0.04)", border: pickerTab === "stickers" ? "1px solid rgba(124,110,250,0.3)" : "1px solid rgba(255,255,255,0.06)", borderRadius:10, cursor: isFriends ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", color: pickerTab === "stickers" ? "#A78BFA" : "#4B5563", transition:"all 0.2s ease", flexShrink:0 }}>
          <Sticker size={17} />
        </motion.button>

        <div style={{ flex:1, position:"relative" }}>
          <input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isFriends}
            placeholder={!isFriends ? "You're not friends anymore" : editingMessage ? "Edit your message…" : "Type a message…"}
            style={{ width:"100%", padding:"11px 16px", background:"rgba(22,28,40,0.9)", border:`1px solid ${newMessage ? "rgba(124,110,250,0.4)" : "rgba(255,255,255,0.06)"}`, borderRadius:14, color:"white", fontSize:14, outline:"none", fontFamily:"'Inter',sans-serif", boxSizing:"border-box", transition:"border-color 0.2s ease", boxShadow: newMessage ? "0 0 0 3px rgba(124,110,250,0.08)" : "none" }}
          />
        </div>

        <motion.button
          whileTap={{ scale:0.92 }}
          onClick={sendMessage}
          disabled={!isFriends}
          className="send-btn"
          style={{ width:42, height:42, background: newMessage.trim() ? "linear-gradient(135deg,#7C6EFA,#A78BFA)" : "rgba(255,255,255,0.04)", border: newMessage.trim() ? "none" : "1px solid rgba(255,255,255,0.06)", borderRadius:13, cursor: isFriends ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", color: newMessage.trim() ? "white" : "#374151", flexShrink:0, transition:"all 0.2s ease", boxShadow: newMessage.trim() ? "0 4px 16px rgba(124,110,250,0.3)" : "none" }}>
          {editingMessage ? <Check size={18} /> : <Send size={16} style={{ transform:"translateX(1px)" }} />}
        </motion.button>
      </div>
    </div>
  );
}