import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import SetupProfile from "./pages/SetupProfile";
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import Stickers from "./pages/Stickers";
import CreateSticker from "./pages/CreateSticker";

function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const migrateAvatarIfNeeded = async (userId: string, avatarUrl: string | null) => {
    if (!avatarUrl || !avatarUrl.includes("googleusercontent.com")) {
      return avatarUrl; // already migrated or no avatar at all
    }

    try {
      const response = await fetch(avatarUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();

      const fileName = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", userId);

      return newUrl;
    } catch (err) {
      console.error("Avatar migration failed:", err);
      return avatarUrl; // fall back to original if migration fails
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data);
    setLoading(false);

    // Migrate Google avatar to our own storage in the background (non-blocking)
    const migratedUrl = await migrateAvatarIfNeeded(userId, data.avatar_url);
    if (migratedUrl !== data.avatar_url) {
      setProfile((prev: any) => (prev ? { ...prev, avatar_url: migratedUrl } : prev));
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "white" }}>Loading...</p>
      </div>
    );
  }

  const needsSetup = user && profile && profile.username?.includes("@");

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/setup" element={user ? <SetupProfile /> : <Navigate to="/login" />} />
        <Route
          path="/"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <Home />
          }
        />
        <Route
          path="/profile"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <Profile />
          }
        />
        <Route
          path="/friends"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <Friends />
          }
        />
        <Route
          path="/chat/:id"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <Chat />
          }
        />
        <Route
          path="/stickers"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <Stickers />
          }
        />
        <Route
          path="/stickers/create"
          element={
            !user ? <Navigate to="/login" /> :
            needsSetup ? <Navigate to="/setup" /> :
            <CreateSticker />
          }
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;