import { supabase } from "../lib/supabase";

export default function Login() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "http://localhost:5173" },
    });
    if (error) alert(error.message);
  };

  return (
    <div style={{ height: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ background: "#1e293b", padding: "40px", borderRadius: "12px", color: "white", textAlign: "center", minWidth: 300 }}>
        <h1 style={{ marginBottom: 8 }}>ConnectX 🚀</h1>
        <p style={{ color: "#94a3b8", marginBottom: 24 }}>Private messaging for your crew</p>
        <button
          onClick={signInWithGoogle}
          style={{ padding: "12px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, width: "100%" }}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}