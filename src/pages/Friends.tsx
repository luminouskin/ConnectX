import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

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

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setCurrentUserId(session.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    setMyProfile(profile);

    loadFriendships(session.user.id);
  };

  const loadFriendships = async (userId: string) => {
    const { data: accepted } = await supabase
      .from("friendships")
      .select("*, sender:profiles!friendships_sender_id_fkey(*), receiver:profiles!friendships_receiver_id_fkey(*)")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friendsList = (accepted || []).map((f: any) =>
      f.sender_id === userId ? f.receiver : f.sender
    );
    setFriends(friendsList);

    const { data: received } = await supabase
      .from("friendships")
      .select("*, sender:profiles!friendships_sender_id_fkey(*)")
      .eq("status", "pending")
      .eq("receiver_id", userId);

    setPendingReceived(received || []);

    const { data: sent } = await supabase
      .from("friendships")
      .select("*, receiver:profiles!friendships_receiver_id_fkey(*)")
      .eq("status", "pending")
      .eq("sender_id", userId);

    setPendingSent(sent || []);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", currentUserId)
      .limit(10);

    if (error) console.error("Search error:", error.message);
    setSearchResults(data || []);
  };

  const sendRequest = async (receiverId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("friendships").insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
      status: "pending",
    });

    if (!error) {
      await supabase.from("notifications").insert({
        user_id: receiverId,
        type: "friend_request",
        title: "New friend request",
        body: `${myProfile?.display_name || "Someone"} sent you a friend request`,
        data: { sender_id: currentUserId },
      });

      loadFriendships(currentUserId);
      handleSearch(searchQuery);
    }
  };

  const acceptRequest = async (friendshipId: string, senderId: string) => {
    if (!currentUserId) return;
    // This update triggers the database trigger that auto-creates the conversation
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);

    await supabase.from("notifications").insert({
      user_id: senderId,
      type: "friend_accepted",
      title: "Friend request accepted",
      body: `${myProfile?.display_name || "Someone"} accepted your friend request`,
      data: { accepter_id: currentUserId },
    });

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
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${friendshipUserId}),and(sender_id.eq.${friendshipUserId},receiver_id.eq.${currentUserId})`
      );
    loadFriendships(currentUserId);
  };

  const getRequestStatus = (profileId: string) => {
    if (friends.some((f) => f.id === profileId)) return "friends";
    if (pendingSent.some((p) => p.receiver.id === profileId)) return "sent";
    if (pendingReceived.some((p) => p.sender.id === profileId)) return "received";
    return "none";
  };

  // Conversation already exists (auto-created on friend-accept) - just find and navigate to it
  const startChat = async (friendId: string) => {
    if (!currentUserId) return;

    const { data: myConvos } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    for (const convo of myConvos || []) {
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", convo.conversation_id);

      const userIds = (members || []).map((m: any) => m.user_id);
      if (userIds.includes(friendId) && userIds.length === 2) {
        navigate(`/chat/${convo.conversation_id}`);
        return;
      }
    }

    // Fallback: shouldn't normally happen since the trigger creates it automatically,
    // but just in case (e.g. friendship existed before the trigger was added)
    console.error("No conversation found for this friend - they may have been friends before the auto-create trigger was set up.");
    showFallbackMessage();
  };

  const showFallbackMessage = () => {
    alert("Couldn't find a conversation with this friend. Try removing and re-adding them as a friend to refresh the connection.");
  };

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", padding: 24, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "#1e293b", border: "none", color: "white", width: 36, height: 36, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          ←
        </button>
        <h1 style={{ margin: 0 }}>Friends</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "friends", label: `Friends (${friends.length})` },
          { key: "requests", label: `Requests (${pendingReceived.length})` },
          { key: "search", label: "Find People" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "8px 16px",
              background: activeTab === tab.key ? "#2563eb" : "#1e293b",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "search" && (
        <div>
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by username or name..."
            style={{ width: "100%", maxWidth: 400, padding: "12px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14, marginBottom: 16, outline: "none" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 500 }}>
            {searchResults.map((p) => {
              const status = getRequestStatus(p.id);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e293b", padding: 12, borderRadius: 10 }}>
                  {p.avatar_url && <img src={p.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%" }} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{p.display_name}</p>
                    <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>@{p.username}</p>
                  </div>
                  {status === "none" && (
                    <button onClick={() => sendRequest(p.id)} style={{ padding: "6px 14px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                      Add Friend
                    </button>
                  )}
                  {status === "sent" && <span style={{ color: "#94a3b8", fontSize: 13 }}>Request Sent</span>}
                  {status === "received" && <span style={{ color: "#06b6d4", fontSize: 13 }}>Check Requests</span>}
                  {status === "friends" && <span style={{ color: "#16a34a", fontSize: 13 }}>✓ Friends</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "requests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 500 }}>
          <div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>RECEIVED</p>
            {pendingReceived.length === 0 && <p style={{ color: "#475569", fontSize: 14 }}>No pending requests</p>}
            {pendingReceived.map((req) => (
              <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e293b", padding: 12, borderRadius: 10, marginBottom: 8 }}>
                {req.sender.avatar_url && <img src={req.sender.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%" }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{req.sender.display_name}</p>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>@{req.sender.username}</p>
                </div>
                <button onClick={() => acceptRequest(req.id, req.sender.id)} style={{ padding: "6px 14px", background: "#16a34a", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                  Accept
                </button>
                <button onClick={() => rejectRequest(req.id)} style={{ padding: "6px 14px", background: "#334155", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                  Reject
                </button>
              </div>
            ))}
          </div>

          <div>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>SENT</p>
            {pendingSent.length === 0 && <p style={{ color: "#475569", fontSize: 14 }}>No sent requests</p>}
            {pendingSent.map((req) => (
              <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e293b", padding: 12, borderRadius: 10, marginBottom: 8 }}>
                {req.receiver.avatar_url && <img src={req.receiver.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%" }} />}
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>{req.receiver.display_name}</p>
                  <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>@{req.receiver.username}</p>
                </div>
                <button onClick={() => cancelRequest(req.id)} style={{ padding: "6px 14px", background: "#334155", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "friends" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 500 }}>
          {friends.length === 0 && <p style={{ color: "#475569", fontSize: 14 }}>No friends yet — search for people to add!</p>}
          {friends.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#1e293b", padding: 12, borderRadius: 10 }}>
              {f.avatar_url && <img src={f.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%" }} />}
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{f.display_name}</p>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>@{f.username}</p>
              </div>
              <button onClick={() => startChat(f.id)} style={{ padding: "6px 14px", background: "#06b6d4", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                Message
              </button>
              <button onClick={() => removeFriend(f.id)} style={{ padding: "6px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}