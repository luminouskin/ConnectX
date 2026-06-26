import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: "#1e293b", padding: 40, borderRadius: 12, minWidth: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "#0f172a", border: "none", color: "white", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ←
          </button>
          <h2 style={{ margin: 0 }}>Edit Profile</h2>
        </div>

        {profile?.avatar_url && (
          <img src={profile.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", border: "2px solid #06b6d4", alignSelf: "center" }} />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: "#94a3b8", fontSize: 13 }}>Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: "#94a3b8", fontSize: 13 }}>Username</label>
          <input
            value={profile?.username || ""}
            disabled
            style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#64748b", fontSize: 14 }}
          />
          <p style={{ margin: 0, color: "#475569", fontSize: 11 }}>Username cannot be changed yet</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: "#94a3b8", fontSize: 13 }}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            style={{ padding: "10px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14, resize: "none" }}
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{ padding: "12px", background: saved ? "#16a34a" : "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}
        >
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}