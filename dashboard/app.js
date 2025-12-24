// app.js
const { createApp, ref, onMounted } = Vue;

createApp({
  data() {
    return {
      theme: localStorage.getItem("theme") || "light",
      token: localStorage.getItem("token") || null,
      username: localStorage.getItem("rememberedUsername") || "",
      password: "",
      rememberMe: localStorage.getItem("rememberMe") === "true",
      loggedInUser: localStorage.getItem("username") || "",
      apps: [],
      config: {},
      form: { name: "", repo: "", branch: "main", port: 3001, pm2: "" },
      loading: false,
      loginLoading: false,
      loginError: null,
      adguardLoading: false,
      adguardOutput: "",
      activeTab: "home",
      systemOutput: "",
      systemStats: null,
      statsInterval: null,
    };
  },
  methods: {
    authHeader() {
      return { Authorization: `Bearer ${this.token}` };
    },
    async login() {
      this.loginLoading = true;
      this.loginError = null;
      try {
        const r = await axios.post("/api/login", { username: this.username, password: this.password });
        this.token = r.data.token;
        localStorage.setItem("token", this.token);
        localStorage.setItem("username", r.data.user);
        this.loggedInUser = r.data.user;

        // Handle remember me
        if (this.rememberMe) {
          localStorage.setItem("rememberMe", "true");
          localStorage.setItem("rememberedUsername", this.username);
        } else {
          localStorage.removeItem("rememberMe");
          localStorage.removeItem("rememberedUsername");
        }

        await this.fetchApps();
        await this.fetchConfig();
      } catch (e) {
        this.loginError = e.response?.data?.error || "Login failed. Please try again.";
      } finally {
        this.loginLoading = false;
      }
    },
    logout() {
      this.token = null;
      this.loggedInUser = "";
      this.username = "";
      this.password = "";
      localStorage.removeItem("token");
      localStorage.removeItem("username");
    },
    async fetchApps() {
      if (!this.token) return;
      try {
        const r = await axios.get("/api/apps", { headers: this.authHeader() });
        this.apps = r.data;
      } catch (e) {
        if (e.response?.status === 401) this.logout();
        console.error("Failed to fetch apps:", e);
      }
    },
    async fetchConfig() {
      if (!this.token) return;
      try {
        const r = await axios.get("/api/config", { headers: this.authHeader() });
        this.config = r.data;
      } catch (e) {
        if (e.response?.status === 401) this.logout();
        console.error("Failed to fetch config:", e);
      }
    },
    async addApp() {
      if (!this.token) return alert("Login required");
      this.loading = true;
      try {
        const r = await axios.post("/api/add-app", this.form, { headers: this.authHeader() });
        alert(`App "${r.data.name}" added & deploy started on port ${r.data.port}`);
        await this.fetchApps();
        await this.fetchConfig();
      } catch (e) {
        alert("Add app failed: " + (e.response?.data?.error || e.message));
      } finally { this.loading = false; }
    },
    async deploy(name) {
      await axios.post("/api/deploy", { name }, { headers: this.authHeader() });
      setTimeout(() => this.fetchApps(), 1500);
    },
    async restart(name) {
      await axios.post("/api/restart", { name }, { headers: this.authHeader() });
      setTimeout(() => this.fetchApps(), 1000);
    },
    async stop(name) {
      await axios.post("/api/stop", { name }, { headers: this.authHeader() });
      setTimeout(() => this.fetchApps(), 1000);
    },
    async remove(name) {
      if (!confirm("Remove app from PM2 and config?")) return;
      await axios.delete("/api/remove", { data: { name }, headers: this.authHeader() });
      setTimeout(() => { this.fetchApps(); this.fetchConfig(); }, 1000);
    },
    async viewLogs(name) {
      const r = await axios.get(`/api/logs/${name}?lines=200`, { headers: this.authHeader() });
      const win = window.open("", "_blank");
      win.document.write(`<pre>${r.data.replace(/</g, "&lt;")}</pre>`);
    },
    async shutdown() {
      if (!confirm("⚠️ Are you sure you want to SHUTDOWN the host machine? This will turn off the server.")) return;
      this.systemOutput = "Executing shutdown command...\n";
      try {
        await axios.post("/api/shutdown", {}, { headers: this.authHeader() });
        this.systemOutput += "\n✅ Shutdown command sent successfully";
        alert("✅ Shutdown command sent successfully");
      } catch (e) {
        this.systemOutput += "\n❌ Error: " + (e.response?.data?.error || e.message);
        alert("❌ Shutdown failed: " + (e.response?.data?.error || e.message));
      }
    },
    async reboot() {
      if (!confirm("⚠️ Are you sure you want to REBOOT the host machine? This will restart the server.")) return;
      this.systemOutput = "Executing reboot command...\n";
      try {
        await axios.post("/api/reboot", {}, { headers: this.authHeader() });
        this.systemOutput += "\n✅ Reboot command sent successfully";
        alert("✅ Reboot command sent successfully");
      } catch (e) {
        this.systemOutput += "\n❌ Error: " + (e.response?.data?.error || e.message);
        alert("❌ Reboot failed: " + (e.response?.data?.error || e.message));
      }
    },
    async updateAdguard() {
      if (!confirm("🔄 Update AdGuard Home to the latest version? This will restart the AdGuard container.")) return;
      this.adguardLoading = true;
      this.adguardOutput = "";
      try {
        const r = await axios.post("/api/update-adguard", {}, { headers: this.authHeader() });
        this.adguardOutput = r.data.output || "Update completed successfully";
        alert("✅ AdGuard Home updated successfully!");
      } catch (e) {
        this.adguardOutput = e.response?.data?.details || e.message;
        alert("❌ AdGuard update failed: " + (e.response?.data?.error || e.message));
      } finally {
        this.adguardLoading = false;
      }
    },
    async fetchSystemStats() {
      if (!this.token) return;
      try {
        const r = await axios.get("/api/system-stats", { headers: this.authHeader() });
        this.systemStats = r.data;
      } catch (e) {
        console.error("Failed to fetch system stats:", e);
      }
    },
    formatBytes(bytes) {
      const gb = bytes / (1024 ** 3);
      return gb.toFixed(2) + ' GB';
    },
    formatUptime(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${mins}m`;
    },
    getProgressClass(percent) {
      if (percent >= 90) return 'danger';
      if (percent >= 75) return 'warning';
      return '';
    },
    // --- Thêm các phương thức cho theme ---
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', this.theme);
      this.applyTheme();
    },
    applyTheme() {
      if (this.theme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  },
  mounted() {
    this.applyTheme(); // Áp dụng theme khi tải trang
    if (this.token && this.loggedInUser) {
      this.fetchApps();
      this.fetchConfig();
      this.fetchSystemStats();
      // Auto-refresh system stats every 5 seconds
      this.statsInterval = setInterval(() => {
        if (this.activeTab === 'home' || this.activeTab === 'system') {
          this.fetchSystemStats();
        }
      }, 5000);
    }
  },
  beforeUnmount() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
  },
  template: `
  <div class="wrap">
    <div v-if="!token" class="login-container">
      <div class="card login-card">
        <div class="login-icon">🔐</div>
        <h3>Welcome Back</h3>
        <p class="subtitle">Sign in to manage your applications</p>
        <form @submit.prevent="login">
          <input v-model="username" type="text" placeholder="Username" required @keyup.enter="login" />
          <input v-model="password" type="password" placeholder="Password" required @keyup.enter="login" />
          <div class="remember-me">
            <input type="checkbox" id="remember-me" v-model="rememberMe" />
            <label for="remember-me">Remember me</label>
          </div>
          <button type="submit" :disabled="loginLoading">
            <span v-if="loginLoading" class="loading"></span>
            {{ loginLoading ? 'Logging in...' : 'Sign In' }}
          </button>
          <p v-if="loginError" style="color: red; margin-top: 16px;">{{ loginError }}</p>
        </form>
      </div>
    </div>
    <div v-else>
      <div class="top">
        <h1>Host: Manager</h1>
        <div style="display: flex; align-items: center; gap: 12px;align-items: baseline;">
          <p style="color: var(--text-secondary); margin: 0; font-size: 0.875rem;">Logged in as <b style="color: var(--primary-color);">{{loggedInUser}}</b></p>
          <button @click="logout">Logout</button>
          <button @click="toggleTheme" class="theme-toggle-button">{{ theme === 'light' ? '🌙' : '☀️' }}</button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button class="tab-button" :class="{ active: activeTab === 'home' }" @click="activeTab = 'home'">
          <i class="bi bi-house-door"></i> Home
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'deploy' }" @click="activeTab = 'deploy'">
          <i class="bi bi-rocket-takeoff"></i> Deploy Apps
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'system' }" @click="activeTab = 'system'">
          <i class="bi bi-gear"></i> System Control
        </button>
      </div>

      <!-- Home Tab -->
      <div class="tab-content" :class="{ active: activeTab === 'home' }">
        <div class="card">
          <h3><i class="bi bi-speedometer2"></i> System Monitor</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">Real-time system resource usage</p>
          <div v-if="systemStats" class="stats-grid">
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-cpu"></i> CPU Usage</div>
              <div class="stat-value">{{ systemStats.cpu.usage }}%</div>
              <div class="stat-subtext">{{ systemStats.cpu.cores }} cores</div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getProgressClass(systemStats.cpu.usage)" :style="{ width: systemStats.cpu.usage + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-memory"></i> Memory Usage</div>
              <div class="stat-value">{{ systemStats.memory.usagePercent }}%</div>
              <div class="stat-subtext">{{ formatBytes(systemStats.memory.used) }} / {{ formatBytes(systemStats.memory.total) }}</div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getProgressClass(systemStats.memory.usagePercent)" :style="{ width: systemStats.memory.usagePercent + '%' }"></div>
              </div>
            </div>
          </div>
          <div v-if="systemStats" class="system-info">
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-pc-display"></i> Host:</span>
              <span class="system-info-value">{{ systemStats.hostname }}</span>
            </div>
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-clock-history"></i> Uptime:</span>
              <span class="system-info-value">{{ formatUptime(systemStats.uptime) }}</span>
            </div>
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-graph-up"></i> Load Avg:</span>
              <span class="system-info-value">{{ systemStats.loadAvg[0].toFixed(2) }}, {{ systemStats.loadAvg[1].toFixed(2) }}, {{ systemStats.loadAvg[2].toFixed(2) }}</span>
            </div>
          </div>
          <p v-else style="text-align: center; color: var(--text-muted); padding: 24px;">Loading system stats...</p>
        </div>

        <div class="card">
          <h3><i class="bi bi-bar-chart"></i> Applications Status</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">Overview of managed applications</p>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-circle-fill text-success"></i> Running Apps</div>
              <div class="stat-value">{{ apps.filter(a => a.pm2_env.status === 'online').length }}</div>
              <div class="stat-subtext">Active applications</div>
            </div>
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-app"></i> Total Apps</div>
              <div class="stat-value">{{ apps.length }}</div>
              <div class="stat-subtext">Managed by PM2</div>
            </div>
          </div>
          <div style="margin-top: 16px; padding: 16px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-weight: 600; color: var(--text-color);">Status Distribution</span>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">{{ apps.length }} total</span>
            </div>
            <div style="display: flex; gap: 8px; height: 40px;">
              <div v-if="apps.filter(a => a.pm2_env.status === 'online').length > 0" 
                   :style="{ flex: apps.filter(a => a.pm2_env.status === 'online').length, background: 'linear-gradient(135deg, var(--success-color) 0%, #059669 100%)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '0.875rem' }">
                {{ apps.filter(a => a.pm2_env.status === 'online').length }}
              </div>
              <div v-if="apps.filter(a => a.pm2_env.status === 'stopped').length > 0"
                   :style="{ flex: apps.filter(a => a.pm2_env.status === 'stopped').length, background: 'linear-gradient(135deg, var(--danger-color) 0%, #dc2626 100%)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '0.875rem' }">
                {{ apps.filter(a => a.pm2_env.status === 'stopped').length }}
              </div>
              <div v-if="apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length > 0"
                   :style="{ flex: apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length, background: 'linear-gradient(135deg, var(--warning-color) 0%, #f59e0b 100%)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '0.875rem' }">
                {{ apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length }}
              </div>
            </div>
            <div style="display: flex; gap: 16px; margin-top: 12px; font-size: 0.875rem;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: var(--success-color); borderRadius: '50%';"></div>
                <span style="color: var(--text-secondary);">Online: {{ apps.filter(a => a.pm2_env.status === 'online').length }}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: var(--danger-color); borderRadius: '50%';"></div>
                <span style="color: var(--text-secondary);">Stopped: {{ apps.filter(a => a.pm2_env.status === 'stopped').length }}</span>
              </div>
              <div v-if="apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length > 0" style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: var(--warning-color); borderRadius: '50%';"></div>
                <span style="color: var(--text-secondary);">Other: {{ apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Deploy Apps Tab -->
      <div class="tab-content" :class="{ active: activeTab === 'deploy' }">

      <div class="card">
        <h3><i class="bi bi-plus-circle"></i> Add New Application</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="form-name">App Name</label>
            <input id="form-name" v-model="form.name" placeholder="my-awesome-app" />
          </div>
          <div class="form-group">
            <label for="form-repo">Git Repository URL</label>
            <input id="form-repo" v-model="form.repo" placeholder="https://github.com/username/repo.git" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="form-branch">Branch</label>
            <input id="form-branch" v-model="form.branch" placeholder="main" />
          </div>
          <div class="form-group">
            <label for="form-pm2">PM2 Name (optional)</label>
            <input id="form-pm2" v-model="form.pm2" placeholder="Leave empty to use app name" />
          </div>
        </div>
        <div class="form-group">
          <label for="form-start-script">Start Script (optional)</label>
          <input id="form-start-script" v-model="form.startScript" placeholder="e.g., app.js or npm -- start" />
        </div>
        <button @click="addApp" :disabled="loading">
          <span v-if="loading" class="loading"></span>
          <i class="bi bi-rocket-takeoff"></i> {{ loading ? 'Adding...' : 'Add & Deploy' }}
        </button>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0;"><i class="bi bi-boxes"></i> Managed Applications</h3>
          <button @click="fetchApps"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Port</th>
              <th>PM2 Name</th>
              <th>Auto Restart</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="app of apps" :key="app.name">
              <td><strong>{{app.name}}</strong></td>
              <td>
                <span class="status-badge" :class="{
                  'status-online': app.pm2_env.status === 'online',
                  'status-stopped': app.pm2_env.status === 'stopped',
                  'status-errored': app.pm2_env.status === 'errored'
                }">
                  <i v-if="app.pm2_env.status === 'online'" class="bi bi-circle-fill text-success"></i>
                  <i v-else-if="app.pm2_env.status === 'stopped'" class="bi bi-circle-fill text-danger"></i>
                  <i v-else class="bi bi-exclamation-circle-fill"></i>
                  {{ app.pm2_env.status === 'online' ? 'Online' : 
                     app.pm2_env.status === 'stopped' ? 'Stopped' : 
                     app.pm2_env.status }}
                </span>
              </td>
              <td>{{ config[app.name]?.port || 'N/A' }}</td>
              <td>{{app.name}}</td>
              <td>{{ app.pm2_env.autorestart ? 'Yes' : 'No' }}</td>
              <td>
                <button @click="deploy(app.name)" title="Deploy latest changes"><i class="bi bi-rocket-takeoff"></i> Deploy</button>
                <button @click="restart(app.name)" title="Restart application"><i class="bi bi-arrow-clockwise"></i> Restart</button>
                <button @click="stop(app.name)" title="Stop application"><i class="bi bi-pause-circle"></i> Stop</button>
                <button @click="viewLogs(app.name)" title="View logs"><i class="bi bi-file-text"></i> Logs</button>
                <button @click="remove(app.name)" title="Remove application" style="background: var(--button-danger-bg); color: white; border: none;"><i class="bi bi-trash"></i> Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="apps.length === 0" style="text-align: center; color: var(--text-muted); margin-top: 24px; font-style: italic;">
          <i class="bi bi-inbox"></i> No applications found. Add your first app above!
        </p>
      </div>
    </div>

    <!-- System Control Tab -->
    <div class="tab-content" :class="{ active: activeTab === 'system' }">
      <div class="card">
        <h3><i class="bi bi-shield-check"></i> AdGuard Home</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">Update AdGuard Home to the latest version</p>
        <button @click="updateAdguard" :disabled="adguardLoading" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none;">
          <span v-if="adguardLoading" class="loading"></span>
          <i class="bi bi-arrow-repeat"></i> {{ adguardLoading ? 'Updating...' : 'Update AdGuard Home' }}
        </button>
        <div v-if="adguardOutput" class="terminal-output">
          {{ adguardOutput }}
        </div>
      </div>

      <div class="card">
        <h3><i class="bi bi-gear"></i> Host Control</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">Control the host machine</p>
        <div class="system-btn-group">
          <button @click="reboot" style="background: var(--warning-color); color: white; border: none;"><i class="bi bi-arrow-repeat"></i> Reboot Host</button>
          <button @click="shutdown" style="background: var(--button-danger-bg); color: white; border: none;"><i class="bi bi-power"></i> Shutdown Host</button>
        </div>
        <div v-if="systemOutput" class="terminal-output">
          {{ systemOutput }}
        </div>
      </div>
    </div>
    </div>
  </div>
  `
}).mount("#app");

