import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { supabase } from "../lib/supabase";

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

    return () => {
      isActive = false;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
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
    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
  };

  const checkFriendshipStatus = async (userId: string, otherUserId: string) => {
    const { data } = await supabase
      .from("friendships")
      .select("status")
      .eq("status", "accepted")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
      )
      .maybeSingle();

    setIsFriends(!!data);
  };

  const loadMyStickers = async (userId: string) => {
    const { data } = await supabase
      .from("stickers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMyStickers(data || []);
  };

  const loadMyConversations = async (userId: string) => {
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    const ids = (memberships || []).map((m: any) => m.conversation_id).filter((id) => id !== conversationId);

    const results = await Promise.all(
      ids.map(async (id: string) => {
        const { data: members } = await supabase
          .from("conversation_members")
          .select("user_id, profiles(*)")
          .eq("conversation_id", id);
        const other = (members || []).find((m: any) => m.user_id !== userId);
        return { conversationId: id, otherUser: other?.profiles };
      })
    );

    setMyConversations(results);
  };

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !conversationId) return null;
    const userId = session.user.id;
    setCurrentUserId(userId);

    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id, profiles(*)")
      .eq("conversation_id", conversationId);

    const other = (members || []).find((m: any) => m.user_id !== userId);
    setOtherUser(other?.profiles || null);

    if (other?.user_id) {
      await checkFriendshipStatus(userId, other.user_id);
    }

    const { data: msgs } = await supabase
      .from("messages")
      .select("*, sender:profiles(*)")
      .eq("conversation_id", conversationId)
      .eq("deleted", false)
      .order("created_at", { ascending: true });

    setMessages(msgs || []);
    setLoading(false);
    loadMyStickers(userId);
    loadMyConversations(userId);

    await markAsRead(userId);

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          if (payload.new.sender_id === userId) return;

          setMessages((prev) => {
            const alreadyExists = prev.some((m) => m.id === payload.new.id);
            if (alreadyExists) return prev;
            return [...prev, { ...payload.new, sender: null, _needsSenderFetch: true }];
          });

          const { data: sender } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", payload.new.sender_id)
            .single();

          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? { ...m, sender, _needsSenderFetch: false } : m))
          );

          await markAsRead(userId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) =>
            payload.new.deleted
              ? prev.filter((m) => m.id !== payload.new.id)
              : prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          if (other?.user_id) checkFriendshipStatus(userId, other.user_id);
        }
      )
      .subscribe();

    return channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !conversationId || !isFriends) return;

    if (editingMessage) {
      const content = newMessage.trim();
      setNewMessage("");
      setEditingMessage(null);

      await supabase
        .from("messages")
        .update({ content, edited: true })
        .eq("id", editingMessage.id);

      setMessages((prev) =>
        prev.map((m) => (m.id === editingMessage.id ? { ...m, content, edited: true } : m))
      );
      return;
    }

    const content = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content,
      type: "text",
      created_at: new Date().toISOString(),
      sender: null,
      _pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content,
        type: "text",
      })
      .select()
      .single();

    if (error) {
      console.error("Send failed:", error.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _pending: false } : m))
      );
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...data, sender: null, _pending: false } : m))
    );
  };

  const sendSticker = async (sticker: any) => {
    if (!currentUserId || !conversationId || !isFriends) return;
    setPickerTab(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: null,
      media_url: sticker.url,
      type: "sticker",
      created_at: new Date().toISOString(),
      sender: null,
      _pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        media_url: sticker.url,
        type: "sticker",
      })
      .select()
      .single();

    await supabase.from("stickers").update({ used_at: new Date().toISOString() }).eq("id", sticker.id);

    if (error) {
      console.error("Sticker send failed:", error.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _failed: true, _pending: false } : m))
      );
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...data, sender: null, _pending: false } : m))
    );
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const togglePicker = (tab: "emoji" | "stickers") => {
    setPickerTab((prev) => (prev === tab ? null : tab));
  };

  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: any) => {
    e.preventDefault();
    e.stopPropagation();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    setContextMenu({ msg, x: point.clientX, y: point.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent, msg: any) => {
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({ msg, x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const copyMessage = (msg: any) => {
    navigator.clipboard.writeText(msg.content || "");
    showToast("Copied to clipboard");
    setContextMenu(null);
  };

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

  const startEdit = (msg: any) => {
    setEditingMessage(msg);
    setNewMessage(msg.content || "");
    setContextMenu(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage("");
  };

  const addStickerToCollection = async (msg: any) => {
    setContextMenu(null);
    if (!currentUserId) return;

    const { error } = await supabase.from("stickers").insert({
      user_id: currentUserId,
      url: msg.media_url,
      thumbnail_url: msg.media_url,
    });

    if (error) {
      showToast("Failed to add sticker");
    } else {
      showToast("Added to your stickers");
      loadMyStickers(currentUserId);
    }
  };

  const forwardMessage = async (targetConversationId: string) => {
    const msg = showForwardPicker;
    setShowForwardPicker(null);
    if (!msg || !currentUserId) return;

    await supabase.from("messages").insert({
      conversation_id: targetConversationId,
      sender_id: currentUserId,
      content: msg.content,
      media_url: msg.media_url,
      type: msg.type,
    });

    showToast("Message forwarded");
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "white" }}>Loading chat...</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", display: "flex", flexDirection: "column", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "transparent", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}
        >
          ←
        </button>
        {otherUser?.avatar_url && (
          <img src={otherUser.avatar_url} style={{ width: 36, height: 36, borderRadius: "50%" }} />
        )}
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{otherUser?.display_name || "Unknown"}</p>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>@{otherUser?.username}</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: "#475569", textAlign: "center", marginTop: 40 }}>No messages yet — say hi! 👋</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;

          if (msg.type === "sticker") {
            return (
              <div
                key={msg.id}
                onContextMenu={(e) => openContextMenu(e, msg)}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchEnd={handleTouchEnd}
                style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  opacity: msg._pending ? 0.6 : 1,
                  cursor: "pointer",
                }}
              >
                <img
                  src={msg.media_url}
                  alt="sticker"
                  style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: msg._failed ? "2px solid #ef4444" : "none" }}
                />
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              onContextMenu={(e) => openContextMenu(e, msg)}
              onTouchStart={(e) => handleTouchStart(e, msg)}
              onTouchEnd={handleTouchEnd}
              style={{
                alignSelf: isMine ? "flex-end" : "flex-start",
                maxWidth: "65%",
                background: msg._failed ? "#7f1d1d" : isMine ? "#2563eb" : "#1e293b",
                padding: "10px 14px",
                borderRadius: 14,
                borderBottomRightRadius: isMine ? 4 : 14,
                borderBottomLeftRadius: isMine ? 14 : 4,
                opacity: msg._pending ? 0.6 : 1,
                cursor: "pointer",
              }}
            >
              <p style={{ margin: 0, fontSize: 14 }}>{msg.content}</p>
              <p style={{ margin: "4px 0 0", fontSize: 10, color: isMine ? "#bfdbfe" : "#64748b", textAlign: "right" }}>
                {msg.edited && !msg._pending && !msg._failed ? "edited · " : ""}
                {msg._failed ? "Failed to send" : msg._pending ? "Sending..." : new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: Math.min(contextMenu.y, window.innerHeight - 250),
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            background: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 10,
            overflow: "hidden",
            zIndex: 1000,
            minWidth: 170,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {contextMenu.msg.type === "text" && (
            <button onClick={() => copyMessage(contextMenu.msg)} style={menuBtnStyle}>
              📋 Copy
            </button>
          )}
          <button onClick={() => { setShowForwardPicker(contextMenu.msg); setContextMenu(null); }} style={menuBtnStyle}>
            ➡️ Forward
          </button>
          {contextMenu.msg.type === "sticker" && contextMenu.msg.sender_id !== currentUserId && (
            <button onClick={() => addStickerToCollection(contextMenu.msg)} style={menuBtnStyle}>
              ⭐ Add to My Stickers
            </button>
          )}
          {contextMenu.msg.sender_id === currentUserId && (
            <>
              {contextMenu.msg.type === "text" && (
                <button onClick={() => startEdit(contextMenu.msg)} style={menuBtnStyle}>
                  ✏️ Edit
                </button>
              )}
              <button onClick={() => deleteMessage(contextMenu.msg, false)} style={menuBtnStyle}>
                🗑️ Delete for me
              </button>
              <button onClick={() => deleteMessage(contextMenu.msg, true)} style={{ ...menuBtnStyle, color: "#ef4444" }}>
                🗑️ Delete for everyone
              </button>
            </>
          )}
          {contextMenu.msg.sender_id !== currentUserId && (
            <button onClick={() => deleteMessage(contextMenu.msg, false)} style={menuBtnStyle}>
              🗑️ Delete for me
            </button>
          )}
        </div>
      )}

      {/* Forward picker modal */}
      {showForwardPicker && (
        <div
          onClick={() => setShowForwardPicker(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#1e293b", borderRadius: 12, padding: 20, width: 320, maxHeight: "60vh", overflowY: "auto" }}
          >
            <h3 style={{ margin: "0 0 12px" }}>Forward to...</h3>
            {myConversations.length === 0 && <p style={{ color: "#64748b", fontSize: 13 }}>No other chats available</p>}
            {myConversations.map((c) => (
              <div
                key={c.conversationId}
                onClick={() => forwardMessage(c.conversationId)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px", cursor: "pointer", borderRadius: 8 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {c.otherUser?.avatar_url && (
                  <img src={c.otherUser.avatar_url} style={{ width: 36, height: 36, borderRadius: "50%" }} />
                )}
                <p style={{ margin: 0, fontSize: 14 }}>{c.otherUser?.display_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#334155",
            color: "white",
            padding: "10px 18px",
            borderRadius: 20,
            fontSize: 13,
            zIndex: 1001,
          }}
        >
          {toast}
        </div>
      )}

      {/* Media picker (Emoji + Stickers tabs) */}
      {pickerTab && isFriends && (
        <div style={{ background: "#1e293b", borderTop: "1px solid #334155", display: "flex", flexDirection: "column", maxHeight: 350 }}>
          <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
            <button
              onClick={() => togglePicker("emoji")}
              style={{
                padding: "6px 14px",
                background: pickerTab === "emoji" ? "#2563eb" : "#0f172a",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              😀 Emoji
            </button>
            <button
              onClick={() => togglePicker("stickers")}
              style={{
                padding: "6px 14px",
                background: pickerTab === "stickers" ? "#2563eb" : "#0f172a",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              🖼️ Stickers
            </button>
          </div>

          <div style={{ padding: pickerTab === "emoji" ? "10px 0 0" : 16, overflowY: "auto", flex: 1 }}>
            {pickerTab === "emoji" && (
              <EmojiPicker
                onEmojiClick={onEmojiClick}
                theme={Theme.DARK}
                width="100%"
                height={300}
                searchDisabled={false}
                skinTonesDisabled={false}
                previewConfig={{ showPreview: false }}
              />
            )}

            {pickerTab === "stickers" && (
              myStickers.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
                  <p style={{ margin: 0 }}>No stickers yet</p>
                  <button
                    onClick={() => navigate("/stickers/create")}
                    style={{ marginTop: 10, padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
                  >
                    Create Your First Sticker
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 8 }}>
                  {myStickers.map((sticker) => (
                    <img
                      key={sticker.id}
                      src={sticker.thumbnail_url || sticker.url}
                      alt="sticker"
                      onClick={() => sendSticker(sticker)}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {editingMessage && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", background: "#334155" }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Editing message</span>
          <button onClick={cancelEdit} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>
            Cancel
          </button>
        </div>
      )}

      {!isFriends && (
        <div style={{ padding: "14px 20px", background: "#7f1d1d", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13 }}>You're no longer friends — add them back to send messages</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, padding: "16px 20px", background: "#1e293b", borderTop: "1px solid #334155", alignItems: "center", opacity: isFriends ? 1 : 0.5 }}>
        <button
          onClick={() => isFriends && togglePicker("emoji")}
          disabled={!isFriends}
          style={{ background: "transparent", border: "none", color: pickerTab === "emoji" ? "#06b6d4" : "white", fontSize: 22, cursor: isFriends ? "pointer" : "not-allowed" }}
        >
          😀
        </button>
        <button
          onClick={() => isFriends && togglePicker("stickers")}
          disabled={!isFriends}
          style={{ background: "transparent", border: "none", color: pickerTab === "stickers" ? "#06b6d4" : "white", fontSize: 22, cursor: isFriends ? "pointer" : "not-allowed" }}
        >
          🖼️
        </button>
        <input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isFriends}
          placeholder={!isFriends ? "You're not friends anymore" : editingMessage ? "Edit your message..." : "Type a message..."}
          style={{ flex: 1, padding: "12px 16px", background: "#0f172a", border: "1px solid #334155", borderRadius: 24, color: "white", fontSize: 14, outline: "none" }}
        />
        <button
          onClick={sendMessage}
          disabled={!isFriends}
          style={{ background: editingMessage ? "#16a34a" : "#2563eb", border: "none", color: "white", width: 44, height: 44, borderRadius: "50%", cursor: isFriends ? "pointer" : "not-allowed", opacity: isFriends ? 1 : 0.6 }}
        >
          {editingMessage ? "✓" : "➤"}
        </button>
      </div>
    </div>
  );
}

const menuBtnStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "12px 16px",
  background: "transparent",
  border: "none",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
};