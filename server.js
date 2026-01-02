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
import http from "http";
import { fileURLToPath } from "url";
import si from "systeminformation";

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
// const keyPath = "/etc/letsencrypt/live/cam-chon.ddns.net/privkey.pem";
// const certPath = "/etc/letsencrypt/live/cam-chon.ddns.net/fullchain.pem";

// let sslOptions = null;

// if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
//   sslOptions = {
//     key: fs.readFileSync(keyPath),
//     cert: fs.readFileSync(certPath),
//   };
// }

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
app.set("trust proxy", true);
const server = http.createServer(app);
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
    return res.json({ token, user: username });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

app.use("/api", (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.split(" ")[1];
  if (!token || !verifyJwt(token)) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// === System Stats (auth required) ===
app.get("/api/system-stats", async (req, res) => {
  try {
    // Get CPU info using systeminformation
    const cpuData = await si.currentLoad();
    const cpuInfo = await si.cpu();

    // Get Memory info using systeminformation
    const memData = await si.mem();

    // Get system info
    const osInfo = await si.osInfo();
    const timeData = await si.time();

    // Temperature data
    // Note: On macOS, systeminformation requires macos-temperature-sensor or osx-temperature-sensor
    // These are installed as optionalDependencies in package.json
    let temperature = null;
    try {
      const tempData = await si.cpuTemperature();
      if (tempData.main !== null && tempData.main !== -1) {
        temperature = {
          main: tempData.main,
          cores: tempData.cores || [],
          max: tempData.max || tempData.main
        };
      }
    } catch (err) {
      // Temperature data not available on this platform
    }

    // Fan speed data - disabled due to platform limitations
    let fans = null;

    // Network speed data
    let network = null;
    try {
      const networkStats = await si.networkStats();
      const networkConnections = await si.networkConnections();

      if (networkStats && networkStats.length > 0) {
        // Get the first active network interface
        const activeInterface = networkStats[0];

        const establishedConnections = networkConnections.filter(
          conn => conn.state === 'ESTABLISHED' || conn.state === 'established'
        );

        network = {
          interface: activeInterface.iface,
          downloadSpeed: activeInterface.rx_sec || 0, // bytes per second
          uploadSpeed: activeInterface.tx_sec || 0,    // bytes per second
          connections: establishedConnections.length,
          connectionsList: establishedConnections.map(c => ({
            local: `${c.localAddress}:${c.localPort}`,
            peer: `${c.peerAddress}:${c.peerPort}`,
            state: c.state,
            process: c.process || ''
          }))
        };
      }
    } catch (err) {
      // Network stats not available
      console.error("Network stats error:", err);
    }

    res.json({
      cpu: {
        usage: Math.round(cpuData.currentLoad),
        cores: cpuInfo.cores,
        model: cpuInfo.manufacturer + ' ' + cpuInfo.brand
      },
      memory: {
        total: memData.total,
        used: memData.used,
        free: memData.free,
        usagePercent: parseFloat(((memData.used / memData.total) * 100).toFixed(1))
      },
      temperature: temperature,
      fans: fans,
      network: network,
      uptime: timeData.uptime,
      loadAvg: [cpuData.avgLoad, cpuData.avgLoad, cpuData.avgLoad], // systeminformation provides avgLoad
      platform: osInfo.platform,
      hostname: osInfo.hostname
    });
  } catch (error) {
    console.error("Error fetching system stats:", error);
    res.status(500).json({ error: "Failed to fetch system stats" });
  }
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
  const { name, repo, branch = "main", pm2, startScript } = req.body || {};
  if (!name || !repo) return res.status(400).json({ error: "name, repo required" });

  const dest = path.join(APP_BASE, name);
  const deployMap = loadDeployMap();

  // Tìm port mới
  const usedPorts = Object.values(deployMap).map(a => parseInt(a.port || 0)).filter(Boolean);
  const nextPort = Math.max(5000, ...usedPorts) + 1;
  const pm2Name = pm2 || name;
  const script = startScript || "npm -- start"; // Mặc định dùng `npm start`

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
      PORT=${nextPort} pm2 start ${script} --name ${pm2Name} --env PORT=${nextPort} ||
      PORT=${nextPort} pm2 restart ${pm2Name}
    `;

    exec(startCmd, { timeout: 10 * 60 * 1000 }, (err2) => {
      if (err2) return res.status(500).json({ error: "Start failed" });

      deployMap[name] = { path: dest, repo, branch, pm2: pm2Name, port: nextPort, startScript: script };
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
    PORT=${cfg.port} pm2 restart ${cfg.pm2} -- --port=${cfg.port}
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

// === System Control ===
app.post("/api/shutdown", (req, res) => {
  // Use osascript (AppleScript) to shutdown without sudo password
  const cmd = 'osascript -e \'tell application "System Events" to shut down\'';

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("Shutdown error:", err.message);
      console.error("stderr:", stderr);
      return res.status(500).json({
        error: "Shutdown failed",
        details: err.message,
        stderr: stderr
      });
    }
    res.json({ ok: true, message: "Shutdown initiated" });
  });
});

app.post("/api/reboot", (req, res) => {
  // Use osascript (AppleScript) to restart without sudo password
  const cmd = 'osascript -e \'tell application "System Events" to restart\'';

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("Reboot error:", err.message);
      console.error("stderr:", stderr);
      return res.status(500).json({
        error: "Reboot failed",
        details: err.message,
        stderr: stderr
      });
    }
    res.json({ ok: true, message: "Reboot initiated" });
  });
});

app.post("/api/update-adguard", (req, res) => {
  const commands = `
    echo "Pulling latest AdGuard Home image..." &&
    docker pull adguard/adguardhome:latest &&
    echo "Stopping AdGuard Home container..." &&
    docker stop adguardhome &&
    echo "Removing old container..." &&
    docker rm adguardhome &&
    echo "Starting new AdGuard Home container..." &&
    docker run -d \
      --name adguardhome \
      -p 53:53/tcp -p 53:53/udp \
      -p 3300:80 \
      -v adguard_conf:/opt/adguardhome/conf \
      -v adguard_work:/opt/adguardhome/work \
      --restart unless-stopped \
      adguard/adguardhome:latest &&
    echo "Setting permissions..." &&
    docker exec -u root adguardhome chown -R adguard:adguard /opt/adguardhome &&
    echo "Checking version..." &&
    docker exec adguardhome /opt/adguardhome/AdGuardHome --version
  `;

  exec(commands, { timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
    if (err) {
      console.error("AdGuard update error:", err.message);
      console.error("stderr:", stderr);
      return res.status(500).json({ error: "AdGuard update failed", details: stderr || err.message });
    }
    console.log("AdGuard update output:", stdout);
    res.json({ ok: true, message: "AdGuard Home updated successfully", output: stdout });
  });
});

// === SERVER START ===
// if (sslOptions) {
//   https.createServer(sslOptions, app).listen(PORT, "0.0.0.0", () => {
//     console.log(`✅ HTTPS Auto Deploy server running on port ${PORT}`);
//     console.log(`   Dashboard: https://your-domain:${PORT}/dashboard/`);
//   });
// } else {
//   http.createServer(app).listen(PORT, "0.0.0.0", () => {
//     console.log(`⚠️  HTTP Auto Deploy server running on port ${PORT} (SSL certs not found)`);
//     console.log(`   Dashboard: http://localhost:${PORT}/dashboard/`);
//   });
// }



server.listen(PORT, () =>
  console.log(`Draft server running on http://localhost:${PORT}`)
);
