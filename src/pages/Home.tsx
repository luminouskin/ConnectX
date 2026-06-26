import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const navigate = useNavigate();

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
  }, []);

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
      .channel(`friend-requests-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friendships", filter: `receiver_id=eq.${session.user.id}` },
        () => {
          loadPendingRequestCount(session.user.id);
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
    { icon: "💬", label: "Chats", path: "/", badge: 0 },
    { icon: "👥", label: "Friends", path: "/friends", badge: pendingRequestCount },
    { icon: "🖼️", label: "Stickers", path: "/stickers", badge: 0 },
    { icon: "⚙️", label: "Settings", path: "/profile", badge: 0 },
  ];

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: "#1e293b", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          onClick={() => navigate("/profile")}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "#0f172a", borderRadius: 10, cursor: "pointer" }}
        >
          {profile?.avatar_url && (
            <img src={profile.avatar_url} alt="avatar" style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #06b6d4" }} />
          )}
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{profile?.display_name}</p>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>@{profile?.username}</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <p style={{ color: "#64748b", fontSize: 12, margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Menu</p>
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{ padding: "10px 14px", background: "transparent", color: "white", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <span>{item.icon} {item.label}</span>
              {item.badge > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "white",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: "2px 7px",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button onClick={logout} style={{ padding: "10px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Logout
        </button>
      </div>

      {/* Chats list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e293b" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Chats</h1>
        </div>

        {loadingChats && (
          <p style={{ color: "#64748b", textAlign: "left", paddingLeft: 24, marginTop: 40 }}>Loading chats...</p>
        )}

        {!loadingChats && conversations.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", height: "70%", gap: 12, color: "#64748b", paddingLeft: 24 }}>
            <p style={{ fontSize: 48, margin: 0 }}>💬</p>
            <p style={{ fontSize: 16, margin: 0 }}>No chats yet</p>
            <button
              onClick={() => navigate("/friends")}
              style={{ padding: "8px 18px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, marginTop: 8 }}
            >
              Find Friends to Message
            </button>
          </div>
        )}

        {!loadingChats &&
          conversations.map((c) => (
            <div
              key={c.conversationId}
              onClick={() => navigate(`/chat/${c.conversationId}`)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 24px",
                cursor: "pointer",
                borderBottom: "1px solid #1e293b",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {c.otherUser?.avatar_url && (
                <img src={c.otherUser.avatar_url} style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{c.otherUser?.display_name || "Unknown"}</p>
                <p
                  style={{
                    margin: 0,
                    color: c.unreadCount > 0 ? "#e2e8f0" : "#94a3b8",
                    fontWeight: c.unreadCount > 0 ? 600 : 400,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.lastMessage?.content || "No messages yet"}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                {c.lastMessage?.created_at && (
                  <p style={{ margin: 0, color: "#64748b", fontSize: 11 }}>
                    {new Date(c.lastMessage.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </p>
                )}
                {c.unreadCount > 0 && (
                  <span
                    style={{
                      background: "#2563eb",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "2px 7px",
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}