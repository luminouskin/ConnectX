import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { supabase } from "../lib/supabase";

export default function CreateSticker() {
  const navigate = useNavigate();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
      setError("Please select a PNG or JPG image");
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImageBlob = async (): Promise<Blob> => {
    const image = new Image();
    image.src = imageSrc!;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const size = 320; // square sticker size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      size,
      size
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/png", 0.9);
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setUploading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const blob = await getCroppedImageBlob();
      const fileName = `${session.user.id}/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("stickers")
        .upload(fileName, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("stickers").getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("stickers").insert({
        user_id: session.user.id,
        url: urlData.publicUrl,
        thumbnail_url: urlData.publicUrl,
      });

      if (dbError) throw dbError;

      navigate("/stickers");
    } catch (err: any) {
      console.error("Sticker creation failed:", err.message);
      setError("Failed to create sticker. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ height: "100vh", background: "#0f172a", color: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "#1e293b" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "transparent", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Create Sticker</h2>
      </div>

      {!imageSrc && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <p style={{ fontSize: 48, margin: 0 }}>🖼️</p>
          <p style={{ color: "#94a3b8", margin: 0 }}>Choose a photo to turn into a sticker</p>
          <label
            style={{
              padding: "12px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Choose Photo
            <input type="file" accept="image/png,image/jpeg" onChange={handleFileSelect} style={{ display: "none" }} />
          </label>
          {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}
        </div>
      )}

      {imageSrc && (
        <>
          <div style={{ flex: 1, position: "relative", background: "#000" }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div style={{ padding: "16px 20px", background: "#1e293b", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1 }}
              />
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setImageSrc(null)}
                style={{ flex: 1, padding: "12px", background: "#334155", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
              >
                Choose Different Photo
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                style={{ flex: 1, padding: "12px", background: "#06b6d4", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
              >
                {uploading ? "Saving..." : "Save Sticker"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}