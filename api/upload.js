// POST /api/upload  { password, name, data }  → saves an image to covers/ in the repo, returns its path
// data = base64 (no data: prefix). Only jpg / png / webp up to ~2.5 MB.
const { passwordOk, wait, putFile, readBody } = require("./_github");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const body = readBody(req);
  if (!passwordOk(body.password)){ await wait(1200); return res.status(401).json({ ok: false, error: "비밀번호가 맞지 않아요" }); }
  const m = /\.(jpe?g|png|webp)$/i.exec(String(body.name || ""));
  if (!m || typeof body.data !== "string") return res.status(400).json({ ok: false, error: "jpg · png · webp 이미지만 올릴 수 있어요" });
  const bytes = Math.floor(body.data.length * 3 / 4);
  if (bytes > 2.5 * 1024 * 1024) return res.status(413).json({ ok: false, error: "이미지가 너무 커요 (2.5MB 이하)" });
  const safe = String(body.name).toLowerCase().replace(/\.[a-z]+$/, "").replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cover";
  const path = `covers/${Date.now().toString(36)}-${safe}.${m[1].toLowerCase().replace("jpeg", "jpg")}`;
  try {
    await putFile(path, body.data, "admin: upload " + path);
    return res.status(200).json({ ok: true, path });
  } catch(err){
    return res.status(500).json({ ok: false, error: "GitHub 업로드 실패: " + err.message });
  }
};
