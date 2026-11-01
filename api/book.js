// POST /api/book  { name, email, phone, spotify, link, engineer, no, lang, website }
// Sends the mixing request to your inbox through Resend.
// Vercel environment variables:
//   RESEND_API_KEY  (required)  the key from resend.com → API Keys
//   BOOK_TO         (required)  the address that receives requests (with the default sender this must be your Resend sign-up email)
//   BOOK_FROM       (optional)  e.g. "JEYA SOUND <booking@jeyasound.com>" once you verify the domain in Resend
const { readBody } = require("./_github");

const hits = new Map();   // best-effort limit: 5 requests per 10 minutes per IP (per server instance)
function limited(ip){
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now); hits.set(ip, arr); if (hits.size > 2000) hits.clear();
  return arr.length > 5;
}
const clip = (v, n) => String(v == null ? "" : v).replace(/\r/g, "").trim().slice(0, n);
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isUrl = s => /^https?:\/\/\S+$/i.test(s);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true });            // honeypot: bots fill the hidden field
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "too many requests" });

  const f = {
    name: clip(b.name, 120), email: clip(b.email, 200), phone: clip(b.phone, 40),
    spotify: clip(b.spotify, 400), link: clip(b.link, 600), engineer: clip(b.engineer, 80),
    no: clip(b.no, 40), lang: clip(b.lang, 4)
  };
  if (!f.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) || f.phone.replace(/\D/g, "").length < 7)
    return res.status(400).json({ ok: false, error: "missing fields" });
  if (f.spotify && !/^https?:\/\//i.test(f.spotify)) f.spotify = "https://" + f.spotify;
  if ((f.spotify && !isUrl(f.spotify)) || (f.link && !isUrl(f.link))) return res.status(400).json({ ok: false, error: "bad link" });

  const key = process.env.RESEND_API_KEY, to = process.env.BOOK_TO;
  if (!key || !to) return res.status(500).json({ ok: false, error: "mail not configured" });

  const rows = [["신청 번호", f.no], ["엔지니어", f.engineer || "상관없음"], ["이름 / 회사", f.name], ["이메일", f.email], ["전화", f.phone],
                ["스포티파이", f.spotify], ["참고 음원 링크", f.link], ["사이트 언어", { ko: "한국어", ja: "日本語", en: "English" }[f.lang] || f.lang]];
  const text = rows.map(([k, v]) => `${k}: ${v || "-"}`).join("\n") + "\n\n이 메일에 답장하면 신청자에게 바로 갑니다.";
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.6;color:#1f1b17">
    <h2 style="margin:0 0 12px;font-size:18px">새 믹싱 의뢰가 들어왔어요</h2>
    <table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#7a6a58;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;word-break:break-all">${v ? (isUrl(v) ? `<a href="${esc(v)}">${esc(v)}</a>` : esc(v)) : "-"}</td></tr>`).join("")}</table>
    <p style="margin-top:18px;color:#7a6a58;font-size:13px">이 메일에 답장하면 신청자(${esc(f.email)})에게 바로 갑니다.</p></div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.BOOK_FROM || "JEYA SOUND <onboarding@resend.dev>",
        to: to.split(",").map(s => s.trim()).filter(Boolean),
        reply_to: f.email,
        subject: `[믹싱 의뢰] ${f.name}${f.engineer ? " → " + f.engineer : ""}`,
        text, html
      })
    });
    if (!r.ok){ const j = await r.json().catch(() => ({})); return res.status(502).json({ ok: false, error: "mail failed: " + (j.message || r.status) }); }
    return res.status(200).json({ ok: true });
  } catch(err){
    return res.status(502).json({ ok: false, error: "mail failed: " + err.message });
  }
};
