import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ImagePlus, ZoomIn, RotateCcw, Save, Loader2, AlertCircle } from "lucide-react";

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
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, size, size);
    return new Promise((resolve) => { canvas.toBlob((blob) => resolve(blob!), "image/png", 0.9); });
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
      const { error: uploadError } = await supabase.storage.from("stickers").upload(fileName, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("stickers").getPublicUrl(fileName);
      const { error: dbError } = await supabase.from("stickers").insert({ user_id: session.user.id, url: urlData.publicUrl, thumbnail_url: urlData.publicUrl });
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
    <div style={{ height:"100vh", background:"#080B14", color:"white", display:"flex", flexDirection:"column", fontFamily:"'Inter',sans-serif", overflow:"hidden", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        @keyframes drift1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,-15px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        input[type=range] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 99px;
          background: rgba(124,110,250,0.2);
          outline: none;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7C6EFA, #A78BFA);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(124,110,250,0.4);
          transition: transform 0.15s ease;
        }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        .choose-btn:hover { border-color: rgba(124,110,250,0.5) !important; background: rgba(124,110,250,0.08) !important; }
        .reset-btn:hover { background: rgba(255,255,255,0.07) !important; }
        .save-btn:hover { box-shadow: 0 6px 24px rgba(124,110,250,0.45) !important; transform: translateY(-1px); }
        .save-btn:active { transform: translateY(0px); }
      `}</style>

      {/* Ambient orbs — only visible on upload screen */}
      {!imageSrc && (
        <>
          <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,110,250,0.09) 0%, transparent 70%)", top:"-100px", left:"-100px", animation:"drift1 14s ease-in-out infinite", pointerEvents:"none" }} />
          <div style={{ position:"absolute", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)", bottom:"-80px", right:"-80px", animation:"drift2 18s ease-in-out infinite", pointerEvents:"none" }} />
        </>
      )}

      {/* ── HEADER ── */}
      <motion.div
        initial={{ opacity:0, y:-12 }}
        animate={{ opacity:1, y:0 }}
        transition={{ duration:0.4, ease:[0.22,1,0.36,1] }}
        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:"rgba(13,17,23,0.95)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(124,110,250,0.08)", flexShrink:0, position:"relative", zIndex:2 }}
      >
        <motion.button
          whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
          onClick={() => navigate(-1)}
          style={{ width:36, height:36, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"white", flexShrink:0 }}
        >
          <ArrowLeft size={16} />
        </motion.button>

        <div>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700, letterSpacing:"-0.3px" }}>Create Sticker</h2>
          <p style={{ margin:0, fontSize:11, color:"#4B5563", marginTop:1 }}>
            {imageSrc ? "Crop and zoom to get the perfect cut" : "Choose a photo to turn into a sticker"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background: imageSrc ? "rgba(124,110,250,0.2)" : "linear-gradient(135deg,#7C6EFA,#A78BFA)", border: imageSrc ? "1px solid rgba(124,110,250,0.3)" : "none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"white" }}>1</div>
          <div style={{ width:16, height:1, background: imageSrc ? "rgba(124,110,250,0.4)" : "rgba(255,255,255,0.08)" }} />
          <div style={{ width:20, height:20, borderRadius:"50%", background: imageSrc ? "linear-gradient(135deg,#7C6EFA,#A78BFA)" : "rgba(255,255,255,0.05)", border: imageSrc ? "none" : "1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color: imageSrc ? "white" : "#374151" }}>2</div>
        </div>
      </motion.div>

      {/* ── UPLOAD SCREEN ── */}
      <AnimatePresence mode="wait">
        {!imageSrc && (
          <motion.div
            key="upload"
            initial={{ opacity:0, y:16 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-16 }}
            transition={{ duration:0.35, ease:[0.22,1,0.36,1] }}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, padding:"24px", position:"relative", zIndex:1 }}
          >
            {/* Upload zone */}
            <label
              className="choose-btn"
              style={{
                width: "100%",
                maxWidth: 360,
                aspectRatio: "1",
                border: "1.5px dashed rgba(124,110,250,0.25)",
                borderRadius: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                cursor: "pointer",
                background: "rgba(124,110,250,0.04)",
                transition: "all 0.2s ease",
              }}
            >
              <motion.div
                initial={{ scale:0.8, opacity:0 }}
                animate={{ scale:1, opacity:1 }}
                transition={{ delay:0.2, duration:0.4, ease:[0.22,1,0.36,1] }}
                style={{ width:72, height:72, borderRadius:22, background:"rgba(124,110,250,0.12)", border:"1px solid rgba(124,110,250,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}
              >
                <ImagePlus size={32} color="#7C6EFA" />
              </motion.div>

              <motion.div
                initial={{ opacity:0, y:6 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay:0.3, duration:0.35 }}
                style={{ textAlign:"center" }}
              >
                <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:600 }}>Drop your image here</p>
                <p style={{ margin:0, fontSize:12, color:"#4B5563", lineHeight:1.5 }}>PNG or JPG · Square crop · 320×320px</p>
              </motion.div>

              <motion.div
                initial={{ opacity:0 }}
                animate={{ opacity:1 }}
                transition={{ delay:0.4, duration:0.35 }}
                style={{ padding:"9px 24px", background:"linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", borderRadius:10, fontSize:13, fontWeight:600, boxShadow:"0 4px 16px rgba(124,110,250,0.3)" }}
              >
                Browse Files
              </motion.div>

              <input type="file" accept="image/png,image/jpeg" onChange={handleFileSelect} style={{ display:"none" }} />
            </label>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                  style={{ display:"flex", alignItems:"center", gap:8, color:"#F87171", fontSize:13, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:10, padding:"10px 14px" }}
                >
                  <AlertCircle size={14} style={{ flexShrink:0 }} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tips */}
            <motion.div
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              transition={{ delay:0.5, duration:0.4 }}
              style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center", maxWidth:360 }}
            >
              {["Square images work best", "High res = sharper sticker", "PNG supports transparency"].map((tip) => (
                <span key={tip} style={{ fontSize:11, color:"#374151", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:99, padding:"5px 12px" }}>
                  {tip}
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* ── CROP SCREEN ── */}
        {imageSrc && (
          <motion.div
            key="crop"
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.3 }}
            style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}
          >
            {/* Cropper area */}
            <div style={{ flex:1, position:"relative", background:"#000" }}>
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

            {/* Controls panel */}
            <motion.div
              initial={{ y:40, opacity:0 }}
              animate={{ y:0, opacity:1 }}
              transition={{ delay:0.1, duration:0.4, ease:[0.22,1,0.36,1] }}
              style={{ background:"rgba(13,17,23,0.98)", backdropFilter:"blur(20px)", borderTop:"1px solid rgba(124,110,250,0.1)", padding:"16px 20px 20px", display:"flex", flexDirection:"column", gap:14, flexShrink:0 }}
            >
              {/* Zoom slider */}
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, color:"#6B7280", flexShrink:0 }}>
                  <ZoomIn size={14} />
                  <span style={{ fontSize:12, fontWeight:500 }}>Zoom</span>
                </div>
                <input
                  type="range"
                  min={1} max={3} step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ flex:1 }}
                />
                <span style={{ fontSize:12, color:"#4B5563", minWidth:32, textAlign:"right" }}>{zoom.toFixed(1)}×</span>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                    style={{ display:"flex", alignItems:"center", gap:8, color:"#F87171", fontSize:13, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:10, padding:"9px 12px" }}
                  >
                    <AlertCircle size={13} style={{ flexShrink:0 }} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Buttons */}
              <div style={{ display:"flex", gap:10 }}>
                <motion.button
                  whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }}
                  onClick={() => setImageSrc(null)}
                  className="reset-btn"
                  style={{ flex:1, padding:"12px", background:"rgba(255,255,255,0.04)", color:"#9CA3AF", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, cursor:"pointer", fontSize:13, fontWeight:500, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"background 0.2s ease" }}
                >
                  <RotateCcw size={14} />
                  Different Photo
                </motion.button>

                <motion.button
                  whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }}
                  onClick={handleSave}
                  disabled={uploading}
                  className="save-btn"
                  style={{ flex:2, padding:"12px", background: uploading ? "#1A1F2E" : "linear-gradient(135deg,#7C6EFA,#A78BFA)", color:"white", border:"none", borderRadius:12, cursor: uploading ? "not-allowed" : "pointer", fontSize:14, fontWeight:600, fontFamily:"'Inter',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s ease", boxShadow: uploading ? "none" : "0 4px 20px rgba(124,110,250,0.35)" }}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={15} style={{ animation:"spin 1s linear infinite" }} />
                      Saving sticker…
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      Save Sticker
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}