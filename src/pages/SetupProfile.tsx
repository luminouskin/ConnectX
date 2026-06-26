import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function SetupProfile() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setError("");

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers and underscores");
      return;
    }

    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (existing) {
      setError("Username is already taken, try another one");
      setLoading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: username.toLowerCase(),
        display_name: displayName.trim(),
      })
      .eq("id", session.user.id);

    setLoading(false);

    if (updateError) {
      setError("Something went wrong, please try again");
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div style={{ height: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: "#1e293b", padding: 40, borderRadius: 12, color: "white", minWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>Set up your profile 👋</h2>
          <p style={{ color: "#94a3b8", margin: "8px 0 0" }}>Choose a username to get started</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: "#94a3b8", fontSize: 13 }}>Username</label>
          <div style={{ display: "flex", alignItems: "center", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px" }}>
            <span style={{ color: "#64748b", marginRight: 4 }}>@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="yourname"
              style={{ background: "transparent", border: "none", color: "white", fontSize: 14, outline: "none", flex: 1 }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: "#94a3b8", fontSize: 13 }}>Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your Name"
            style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14, outline: "none" }}
          />
        </div>

        {error && (
          <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleSetup}
          disabled={loading}
          style={{ padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}
        >
          {loading ? "Setting up..." : "Continue →"}
        </button>
      </div>
    </div>
  );
}