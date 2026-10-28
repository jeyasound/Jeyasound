// shared helpers for the admin API (Vercel Node functions). Secrets live only in Vercel env vars.
const crypto = require("crypto");

const REPO = process.env.GITHUB_REPO || "jeyasound/Jeyasound";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function passwordOk(given){
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function gh(path, opts = {}){
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error("GITHUB_TOKEN is not set in Vercel"), { status: 500 });
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "jeyasound-admin", ...(opts.headers || {}) }
  });
  const text = await r.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch(e){ body = text; }
  if (!r.ok && r.status !== 404) throw Object.assign(new Error((body && body.message) || ("GitHub " + r.status)), { status: r.status });
  return { status: r.status, body };
}

// create or replace one file in the repo (one commit)
async function putFile(filePath, base64, message){
  const cur = await gh(`/contents/${encodeURI(filePath)}?ref=${BRANCH}`);
  const sha = cur.status === 200 && cur.body && cur.body.sha ? cur.body.sha : undefined;
  const res = await gh(`/contents/${encodeURI(filePath)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
  return res.body && res.body.commit ? res.body.commit.sha : null;
}

function readBody(req){
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch(e){ return {}; }
}

module.exports = { passwordOk, wait, putFile, readBody };
