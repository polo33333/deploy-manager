// === Auto Deploy Server ===
// version 2025-11-02

import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import crypto from "crypto";
import url from "url";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const GITHUB_SECRET = "abc123"; // optional
const ADMIN_USER = "admin";
const ADMIN_PASS = "12345678.c"; // ĐỔI NGAY
const JWT_SECRET = "jwt_super_secret_change_me";

const APP_BASE = "/Users/kdone/dev"; // nơi chứa các repo clone về
const CONFIG_DIR = path.join(__dirname, "config");
const CONFIG_FILE = path.join(CONFIG_DIR, "deploy-map.json");

// === Đường dẫn chứng chỉ SSL ===
const options = {
  key: fs.readFileSync("/etc/letsencrypt/live/cam-chon.ddns.net/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/cam-chon.ddns.net/fullchain.pem"),
};

// === đảm bảo file config tồn tại ===
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2));

function loadDeployMap() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveDeployMap(obj) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2));
}

// === JWT nhẹ ===
function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function signJwt(payloadObj) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${header}.${payload}.${sig}`;
}
function verifyJwt(token) {
  try {
    const [h, p, s] = token.split(".");
    const expected = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${h}.${p}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    if (s !== expected) return false;
    const payload = JSON.parse(Buffer.from(p, "base64").toString());
    if (payload.exp && Date.now() > payload.exp) return false;
    return payload;
  } catch {
    return false;
  }
}

// === Verify GitHub Webhook ===
function verifyGitHubSignature(reqBodyRaw, signature) {
  if (!signature) return false;
  const h = crypto.createHmac("sha256", GITHUB_SECRET).update(reqBodyRaw).digest("hex");
  return `sha256=${h}` === signature;
}

// === EXPRESS APP ===
const app = express();
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Vue mini dashboard
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));
app.get("/", (req, res) => res.redirect("/dashboard/"));

// === GITHUB WEBHOOK ===
app.post("/webhook", (req, res) => {
  const raw = JSON.stringify(req.body || {});
  const signature = req.headers["x-hub-signature-256"];
  if (GITHUB_SECRET && !verifyGitHubSignature(raw, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const parsedUrl = url.parse(req.originalUrl, true);
  const appName = parsedUrl.query.app || parsedUrl.pathname.split("/").pop();
  const deployMap = loadDeployMap();
  const cfg = deployMap[appName];
  if (!cfg) return res.status(404).send("No app config");

  const cmd = `
    cd ${cfg.path} &&
    git fetch origin ${cfg.branch} &&
    git reset --hard origin/${cfg.branch} &&
    npm install --omit=dev &&
    PORT=${cfg.port || ""} pm2 restart ${cfg.pm2}
  `;
  exec(cmd, (err, stdout, stderr) => {
    if (err) console.error("Deploy error:", err.message);
    if (stderr) console.warn(stderr);
    console.log(stdout);
  });

  res.send(`Deploy triggered for ${appName}`);
});

// === AUTH ===
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const payload = { user: username, exp: Date.now() + 6 * 3600 * 1000 };
    const token = signJwt(payload);
    return res.json({ token });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

app.use("/api", (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.split(" ")[1];
  if (!token || !verifyJwt(token)) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// === API: Danh sách PM2 ===
app.get("/api/apps", (req, res) => {
  exec("pm2 jlist", (err, stdout) => {
    if (err) return res.json([]);
    try {
      res.json(JSON.parse(stdout));
    } catch {
      res.json([]);
    }
  });
});

// === API: Deploy map ===
app.get("/api/config", (req, res) => res.json(loadDeployMap()));

// === API: Thêm app (auto clone + auto port) ===
app.post("/api/add-app", (req, res) => {
  const { name, repo, branch = "main" } = req.body || {};
  if (!name || !repo) return res.status(400).json({ error: "name, repo required" });

  const dest = path.join(APP_BASE, name);
  const deployMap = loadDeployMap();

  // Tìm port mới
  const usedPorts = Object.values(deployMap).map(a => parseInt(a.port || 0)).filter(Boolean);
  const nextPort = Math.max(5000, ...usedPorts) + 1;
  const pm2Name = name;

  const cloneCmd = `
    mkdir -p ${APP_BASE} &&
    cd ${APP_BASE} &&
    if [ ! -d "${dest}" ]; then
      git clone -b ${branch} ${repo} ${name};
    else
      cd ${name} && git fetch && git checkout ${branch} && git pull;
    fi
  `;

  exec(cloneCmd, { timeout: 10 * 60 * 1000 }, (err) => {
    if (err) return res.status(500).json({ error: "Clone failed" });

    const startCmd = `
      cd ${dest} &&
      npm install --omit=dev &&
      PORT=${nextPort} pm2 start server.js --name ${pm2Name} --env PORT=${nextPort} ||
      PORT=${nextPort} pm2 restart ${pm2Name}
    `;

    exec(startCmd, { timeout: 10 * 60 * 1000 }, (err2) => {
      if (err2) return res.status(500).json({ error: "Start failed" });

      deployMap[name] = { path: dest, repo, branch, pm2: pm2Name, port: nextPort };
      saveDeployMap(deployMap);
      res.json({ ok: true, name, port: nextPort });
    });
  });
});

// === Các API tiện ích ===
app.post("/api/deploy", (req, res) => {
  const { name } = req.body;
  const map = loadDeployMap();
  const cfg = map[name];
  if (!cfg) return res.status(404).json({ error: "not found" });

  const cmd = `
    cd ${cfg.path} &&
    git fetch origin ${cfg.branch} &&
    git reset --hard origin/${cfg.branch} &&
    npm install --omit=dev &&
    PORT=${cfg.port} pm2 restart ${cfg.pm2}
  `;
  exec(cmd, (err) => {
    if (err) return res.status(500).json({ error: "Deploy failed" });
    res.json({ ok: true });
  });
});

app.post("/api/restart", (req, res) => {
  const { name } = req.body;
  exec(`pm2 restart ${name}`, (err) => {
    if (err) return res.status(500).json({ error: "Restart failed" });
    res.json({ ok: true });
  });
});

app.post("/api/stop", (req, res) => {
  const { name } = req.body;
  exec(`pm2 stop ${name}`, (err) => {
    if (err) return res.status(500).json({ error: "Stop failed" });
    res.json({ ok: true });
  });
});

app.delete("/api/remove", (req, res) => {
  const { name } = req.body;
  exec(`pm2 delete ${name}`, (err) => {
    const map = loadDeployMap();
    delete map[name];
    saveDeployMap(map);
    if (err) return res.status(500).json({ error: "Remove failed" });
    res.json({ ok: true });
  });
});

app.get("/api/logs/:name", (req, res) => {
  const name = req.params.name;
  const lines = parseInt(req.query.lines) || 200;
  const home = process.env.HOME || "/Users/kdone";
  const logPath = path.join(home, ".pm2", "logs", `${name}-out.log`);
  if (fs.existsSync(logPath)) {
    const data = fs.readFileSync(logPath, "utf8").split("\n").slice(-lines).join("\n");
    return res.type("text/plain").send(data);
  }
  res.status(404).send("No logs found");
});

// === SERVER START ===
https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
  console.log(`✅ HTTPS Auto Deploy server running on https://cam-chon.ddns.net:${PORT}`);
  console.log(`Dashboard: https://cam-chon.ddns.net:${PORT}/dashboard/`);
});
