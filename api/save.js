// POST /api/save  { password, content }  → writes content.json to the repo (Vercel redeploys automatically)
// POST /api/save  { password, check: true } → just checks the password
const { passwordOk, wait, putFile, readBody } = require("./_github");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const body = readBody(req);
  if (!passwordOk(body.password)){ await wait(1200); return res.status(401).json({ ok: false, error: "비밀번호가 맞지 않아요" }); }
  if (body.check) return res.status(200).json({ ok: true });
  const c = body.content;
  if (!c || typeof c !== "object" || Array.isArray(c)) return res.status(400).json({ ok: false, error: "내용 형식이 올바르지 않아요" });
  const json = JSON.stringify(c, null, 2);
  if (json.length > 300000) return res.status(413).json({ ok: false, error: "내용이 너무 커요" });
  try {
    const sha = await putFile("content.json", Buffer.from(json, "utf8").toString("base64"), "admin: update site content");
    return res.status(200).json({ ok: true, commit: sha });
  } catch(err){
    return res.status(err.status === 401 || err.status === 403 ? 502 : 500).json({ ok: false, error: "GitHub 저장 실패: " + err.message });
  }
};
