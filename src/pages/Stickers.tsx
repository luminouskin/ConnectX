import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Stickers() {
  const navigate = useNavigate();
  const [stickers, setStickers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"my" | "recent" | "favorites">("my");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStickers();
  }, []);

  const loadStickers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("stickers")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    setStickers(data || []);
    setLoading(false);
  };

  const toggleFavorite = async (stickerId: string, current: boolean) => {
    await supabase.from("stickers").update({ favorited: !current }).eq("id", stickerId);
    setStickers((prev) => prev.map((s) => (s.id === stickerId ? { ...s, favorited: !current } : s)));
  };

  const deleteSticker = async (sticker: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Extract the storage path from the URL to delete the actual file too
    const urlParts = sticker.url.split("/stickers/");
    const filePath = urlParts[1];

    await supabase.storage.from("stickers").remove([filePath]);
    await supabase.from("stickers").delete().eq("id", sticker.id);

    setStickers((prev) => prev.filter((s) => s.id !== sticker.id));
  };

  const filteredStickers =
    activeTab === "favorites"
      ? stickers.filter((s) => s.favorited)
      : activeTab === "recent"
      ? [...stickers].sort((a, b) => (b.used_at || "").localeCompare(a.used_at || "")).slice(0, 20)
      : stickers;

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#1e293b" }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "transparent", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>My Stickers</h2>
        <button
          onClick={() => navigate("/stickers/create")}
          style={{ padding: "8px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
        >
          + New
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "16px 20px 0" }}>
        {[
          { key: "my", label: "My Stickers" },
          { key: "recent", label: "Recent" },
          { key: "favorites", label: "Favorites" },
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
              fontSize: 13,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {loading && <p style={{ color: "#64748b" }}>Loading stickers...</p>}

        {!loading && filteredStickers.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 12, color: "#64748b" }}>
            <p style={{ fontSize: 48, margin: 0 }}>🖼️</p>
            <p style={{ margin: 0 }}>
              {activeTab === "favorites" ? "No favorite stickers yet" : activeTab === "recent" ? "No recently used stickers" : "No stickers yet — create your first one!"}
            </p>
            {activeTab === "my" && (
              <button
                onClick={() => navigate("/stickers/create")}
                style={{ padding: "10px 20px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}
              >
                Create Sticker
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
          {filteredStickers.map((sticker) => (
            <div
              key={sticker.id}
              style={{
                position: "relative",
                background: "#1e293b",
                borderRadius: 12,
                padding: 8,
                aspectRatio: "1",
              }}
            >
              <img
                src={sticker.thumbnail_url || sticker.url}
                alt="sticker"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
              />
              <button
                onClick={() => toggleFavorite(sticker.id, sticker.favorited)}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  background: "rgba(0,0,0,0.5)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {sticker.favorited ? "⭐" : "☆"}
              </button>
              <button
                onClick={() => deleteSticker(sticker)}
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  background: "rgba(239,68,68,0.8)",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "white",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}