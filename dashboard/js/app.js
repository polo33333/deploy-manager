// app.js
const { createApp, ref, onMounted } = Vue;


createApp({
  data() {
    return {
      lang: localStorage.getItem("lang") || "vi",
      theme: localStorage.getItem("theme") || "light",
      token: localStorage.getItem("token") || null,
      username: localStorage.getItem("rememberMe") === "true" ? (localStorage.getItem("rememberedUsername") || "") : "",
      password: "",
      rememberMe: localStorage.getItem("rememberMe") === "true",
      loggedInUser: localStorage.getItem("username") || "",
      apps: [],
      config: {},
      form: { name: "", repo: "", branch: "main", port: 3001, pm2: "" },
      loading: false,
      loginLoading: false,
      loginError: null,
      initialLoading: false,
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

        // Show initial loading
        this.initialLoading = true;

        await this.fetchApps();
        await this.fetchConfig();
        await this.fetchSystemStats();

        // Hide initial loading
        this.initialLoading = false;

        // Clear existing interval if any
        if (this.statsInterval) {
          clearInterval(this.statsInterval);
        }

        // Start auto-refresh system stats every 5 seconds
        this.statsInterval = setInterval(() => {
          if (this.activeTab === 'home' || this.activeTab === 'system') {
            this.fetchSystemStats();
          }
        }, 5000);
      } catch (e) {
        this.loginError = e.response?.data?.error || "Login failed. Please try again.";
      } finally {
        this.loginLoading = false;
      }
    },
    // Manual logout with confirmation
    handleLogout() {
      if (!confirm(this.t('logoutConfirm'))) {
        return; // User cancelled logout
      }
      this.doLogout();
    },
    // Internal logout function (used for both manual and auto logout)
    doLogout() {
      this.token = null;
      this.loggedInUser = "";
      this.password = "";
      localStorage.removeItem("token");
      localStorage.removeItem("username");

      // Restore username from rememberMe if enabled
      if (this.rememberMe && localStorage.getItem("rememberedUsername")) {
        this.username = localStorage.getItem("rememberedUsername");
      } else {
        this.username = "";
      }
    },
    async fetchApps() {
      if (!this.token) return;
      try {
        const r = await axios.get("/api/apps", { headers: this.authHeader() });
        this.apps = r.data;
      } catch (e) {
        if (e.response?.status === 401) this.doLogout();
        console.error("Failed to fetch apps:", e);
      }
    },
    async fetchConfig() {
      if (!this.token) return;
      try {
        const r = await axios.get("/api/config", { headers: this.authHeader() });
        this.config = r.data;
      } catch (e) {
        if (e.response?.status === 401) this.doLogout();
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
    getTempClass(temp) {
      if (temp >= 80) return 'temp-hot';
      if (temp >= 60) return 'temp-warm';
      return 'temp-normal';
    },
    formatTemp(temp) {
      return temp ? temp.toFixed(1) + '°C' : 'N/A';
    },
    formatSpeed(bytesPerSec) {
      if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s';
      const kbps = bytesPerSec / 1024;
      if (kbps < 1024) {
        return kbps.toFixed(2) + ' KB/s';
      }
      const mbps = kbps / 1024;
      return mbps.toFixed(2) + ' MB/s';
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
    },
    // --- Language methods ---
    t(key) {
      return translations[this.lang][key] || key;
    },
    toggleLang() {
      this.lang = this.lang === 'vi' ? 'en' : 'vi';
      localStorage.setItem('lang', this.lang);
    }
  },
  async mounted() {
    this.applyTheme(); // Áp dụng theme khi tải trang
    if (this.token && this.loggedInUser) {
      this.initialLoading = true;
      await this.fetchApps();
      await this.fetchConfig();
      await this.fetchSystemStats();
      this.initialLoading = false;
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
        <h3>{{ t('loginTitle') }}</h3>
        <p class="subtitle">{{ t('loginSubtitle') }}</p>
        <form @submit.prevent="login">
          <input v-model="username" type="text" :placeholder="t('username')" required @keyup.enter="login" />
          <input v-model="password" type="password" :placeholder="t('password')" required @keyup.enter="login" />
          <div class="remember-me">
            <input type="checkbox" id="remember-me" v-model="rememberMe" />
            <label for="remember-me">{{ t('rememberMe') }}</label>
          </div>
          <button type="submit" :disabled="loginLoading">
            <span v-if="loginLoading" class="loading"></span>
            {{ loginLoading ? t('loggingIn') : t('signIn') }}
          </button>
          <p v-if="loginError" style="color: red; margin-top: 16px;">{{ t('loginFailed') }}</p>
        </form>
      </div>
    </div>
    <div v-else>
      <div class="top">
        <div class="header-left">
          <h1>{{ t('appTitle') }}</h1>
          <p class="user-info">{{ t('loggedInAs') }} <span class="username">{{loggedInUser}}</span></p>
        </div>
        <div class="header-right">
          <button @click="toggleLang" class="icon-button" :title="lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'">
            <i :class="lang === 'vi' ? 'bi bi-translate' : 'bi bi-translate'"></i>
            <span class="lang-text">{{ lang === 'vi' ? 'EN' : 'VI' }}</span>
          </button>
          <button @click="toggleTheme" class="icon-button" :title="theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'">
            <i :class="theme === 'light' ? 'bi bi-moon-stars' : 'bi bi-sun'"></i>
          </button>
          <button @click="handleLogout" class="logout-button"><i class="bi bi-box-arrow-right"></i> {{ t('logout') }}</button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button class="tab-button" :class="{ active: activeTab === 'home' }" @click="activeTab = 'home'">
          <i class="bi bi-house-door"></i> {{ t('tabHome') }}
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'deploy' }" @click="activeTab = 'deploy'">
          <i class="bi bi-rocket-takeoff"></i> {{ t('tabDeploy') }}
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'system' }" @click="activeTab = 'system'">
          <i class="bi bi-gear"></i> {{ t('tabSystem') }}
        </button>
        <button class="tab-button" :class="{ active: activeTab === 'about' }" @click="activeTab = 'about'">
          <i class="bi bi-info-circle"></i> {{ t('tabAbout') }}
        </button>
      </div>

      <!-- Home Tab -->
      <div class="tab-content" :class="{ active: activeTab === 'home' }">
        <div class="card">
          <h3><i class="bi bi-speedometer2"></i> {{ t('systemMonitor') }}</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">{{ t('systemMonitorDesc') }}</p>
          
          <!-- Skeleton Loading for System Stats -->
          <div v-if="initialLoading" class="stats-grid">
            <div class="skeleton skeleton-stat"></div>
            <div class="skeleton skeleton-stat"></div>
            <div class="skeleton skeleton-stat"></div>
            <div class="skeleton skeleton-stat"></div>
          </div>
          
          <!-- Actual System Stats -->
          <div v-else-if="systemStats" class="stats-grid">
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-cpu"></i> {{ t('cpuUsage') }}</div>
              <div class="stat-value">{{ systemStats.cpu.usage }}%</div>
              <div class="stat-subtext">{{ systemStats.cpu.cores }} {{ t('cores') }}</div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getProgressClass(systemStats.cpu.usage)" :style="{ width: systemStats.cpu.usage + '%' }"></div>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-memory"></i> {{ t('memoryUsage') }}</div>
              <div class="stat-value">{{ systemStats.memory.usagePercent }}%</div>
              <div class="stat-subtext">{{ formatBytes(systemStats.memory.used) }} / {{ formatBytes(systemStats.memory.total) }}</div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getProgressClass(systemStats.memory.usagePercent)" :style="{ width: systemStats.memory.usagePercent + '%' }"></div>
              </div>
            </div>
            <div v-if="systemStats.temperature" class="stat-item">
              <div class="stat-label"><i class="bi bi-thermometer-half"></i> {{ t('cpuTemp') }}</div>
              <div class="stat-value" :class="getTempClass(systemStats.temperature.max)">{{ formatTemp(systemStats.temperature.max) }}</div>
              <div class="stat-subtext">{{ t('max') }}: {{ formatTemp(systemStats.temperature.max) }}</div>
              <div class="progress-bar">
                <div class="progress-fill" :class="getTempClass(systemStats.temperature.max)" :style="{ width: Math.min(systemStats.temperature.max, 100) + '%' }"></div>
              </div>
            </div>
            <div v-if="systemStats.fans && systemStats.fans.length > 0" class="stat-item">
              <div class="stat-label"><i class="bi bi-fan"></i> {{ t('fanSpeed') }}</div>
              <div class="stat-value">{{ systemStats.fans[0].rpm }} RPM</div>
              <div class="stat-subtext">{{ systemStats.fans[0].label }}</div>
            </div>
            <div v-if="systemStats.network" class="stat-item">
              <div class="stat-label"><i class="bi bi-speedometer"></i> {{ t('networkSpeed') }}</div>
              <div class="stat-value" style="display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="bi bi-arrow-down-circle" style="color: var(--success-color);"></i>
                  <span style="min-width: 50px;">{{ t('downloadSpeed') }}:</span>
                  <span>{{ formatSpeed(systemStats.network.downloadSpeed) }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i class="bi bi-arrow-up-circle" style="color: var(--primary-color);"></i>
                  <span style="min-width: 50px;">{{ t('uploadSpeed') }}:</span>
                  <span>{{ formatSpeed(systemStats.network.uploadSpeed) }}</span>
                </div>
              </div>
              <div class="stat-subtext">
                {{ systemStats.network.interface }}
                <span v-if="systemStats.network.connections !== undefined" style="margin-left: 8px; color: var(--primary-color);">
                  • {{ systemStats.network.connections }} {{ t('connections') }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Skeleton Loading for System Info -->
          <div v-if="initialLoading" style="margin-top: 16px;">
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 70%;"></div>
          </div>
          
          <!-- Actual System Info -->
          <div v-else-if="systemStats" class="system-info">
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-pc-display"></i> {{ t('host') }}:</span>
              <span class="system-info-value">{{ systemStats.hostname }}</span>
            </div>
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-clock-history"></i> {{ t('uptime') }}:</span>
              <span class="system-info-value">{{ formatUptime(systemStats.uptime) }}</span>
            </div>
            <div class="system-info-item">
              <span class="system-info-label"><i class="bi bi-graph-up"></i> {{ t('loadAvg') }}:</span>
              <span class="system-info-value">{{ systemStats.loadAvg[0].toFixed(2) }}, {{ systemStats.loadAvg[1].toFixed(2) }}, {{ systemStats.loadAvg[2].toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3><i class="bi bi-bar-chart"></i> {{ t('appsStatus') }}</h3>
          <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">{{ t('appsStatusDesc') }}</p>
          
          <!-- Skeleton Loading for Apps Status -->
          <div v-if="initialLoading" class="stats-grid">
            <div class="skeleton skeleton-stat"></div>
            <div class="skeleton skeleton-stat"></div>
          </div>
          
          <!-- Actual Apps Status -->
          <div v-else class="stats-grid">
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-circle-fill text-success"></i> {{ t('runningApps') }}</div>
              <div class="stat-value">{{ apps.filter(a => a.pm2_env.status === 'online').length }}</div>
              <div class="stat-subtext">{{ t('activeApps') }}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label"><i class="bi bi-app"></i> {{ t('totalApps') }}</div>
              <div class="stat-value">{{ apps.length }}</div>
              <div class="stat-subtext">{{ t('managedByPM2') }}</div>
            </div>
          </div>
          <div style="margin-top: 16px; padding: 16px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-weight: 600; color: var(--text-color);">{{ t('statusDistribution') }}</span>
              <span style="font-size: 0.875rem; color: var(--text-secondary);">{{ apps.length }} {{ t('total') }}</span>
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
                <span style="color: var(--text-secondary);">{{ t('online') }}: {{ apps.filter(a => a.pm2_env.status === 'online').length }}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: var(--danger-color); borderRadius: '50%';"></div>
                <span style="color: var(--text-secondary);">{{ t('stopped') }}: {{ apps.filter(a => a.pm2_env.status === 'stopped').length }}</span>
              </div>
              <div v-if="apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length > 0" style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: var(--warning-color); borderRadius: '50%';"></div>
                <span style="color: var(--text-secondary);">{{ t('other') }}: {{ apps.filter(a => a.pm2_env.status !== 'online' && a.pm2_env.status !== 'stopped').length }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Deploy Apps Tab -->
      <div class="tab-content" :class="{ active: activeTab === 'deploy' }">

      <div class="card">
        <h3><i class="bi bi-plus-circle"></i> {{ t('addNewApp') }}</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="form-name">{{ t('appName') }}</label>
            <input id="form-name" v-model="form.name" :placeholder="t('appName')" />
          </div>
          <div class="form-group">
            <label for="form-repo">{{ t('gitRepo') }}</label>
            <input id="form-repo" v-model="form.repo" :placeholder="t('gitRepo')" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="form-branch">{{ t('branch') }}</label>
            <input id="form-branch" v-model="form.branch" :placeholder="t('branch')" />
          </div>
          <div class="form-group">
            <label for="form-pm2">{{ t('pm2Name') }}</label>
            <input id="form-pm2" v-model="form.pm2" :placeholder="t('pm2NamePlaceholder')" />
          </div>
        </div>
        <div class="form-group">
          <label for="form-start-script">{{ t('startScript') }}</label>
          <input id="form-start-script" v-model="form.startScript" :placeholder="t('startScriptPlaceholder')" />
        </div>
        <div style="text-align: right;">
          <button class="btn-primary" @click="addApp" :disabled="loading">
            <span v-if="loading" class="loading"></span>
            <i class="bi bi-rocket-takeoff"></i> {{ loading ? t('adding') : t('addDeploy') }}
          </button>
        </div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0;"><i class="bi bi-boxes"></i> {{ t('managedApps') }}</h3>
          <button @click="fetchApps"><i class="bi bi-arrow-clockwise"></i> {{ t('refresh') }}</button>
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
          <i class="bi bi-inbox"></i> {{ t('noApps') }}
        </p>
      </div>
    </div>

    <!-- System Control Tab -->
    <div class="tab-content" :class="{ active: activeTab === 'system' }">
      <div class="card">
        <h3><i class="bi bi-shield-check"></i> {{ t('adguardHome') }}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">{{ t('adguardDesc') }}</p>
        <button @click="updateAdguard" :disabled="adguardLoading" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none;">
          <span v-if="adguardLoading" class="loading"></span>
          <i class="bi bi-arrow-repeat"></i> {{ adguardLoading ? t('updating') : t('updateAdguard') }}
        </button>
        <div v-if="adguardOutput" class="terminal-output">
          {{ adguardOutput }}
        </div>
      </div>

      <div class="card">
        <h3><i class="bi bi-gear"></i> {{ t('hostControl') }}</h3>
        <p style="color: var(--text-secondary); margin-bottom: 16px; font-size: 0.9375rem;">{{ t('hostControlDesc') }}</p>
        <div class="system-btn-group">
          <button @click="reboot" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none;"><i class="bi bi-arrow-repeat"></i> {{ t('rebootHost') }}</button>
          <button @click="shutdown" style="background: var(--button-danger-bg); color: white; border: none;"><i class="bi bi-power"></i> {{ t('shutdownHost') }}</button>
        </div>
        <div v-if="systemOutput" class="terminal-output">
          {{ systemOutput }}
        </div>
      </div>

    </div>

    <!-- About Tab -->
    <div class="tab-content" :class="{ active: activeTab === 'about' }">
      <div class="card about-card">
        <h3><i class="bi bi-info-circle"></i> {{ lang === 'vi' ? 'Thông Tin' : 'About' }}</h3>
        <div class="about-content">
          <div class="about-item">
            <div class="about-label"><i class="bi bi-code-square"></i> {{ lang === 'vi' ? 'Phiên bản' : 'Version' }}</div>
            <div class="about-value">v2.0.0</div>
          </div>
          <div class="about-item">
            <div class="about-label"><i class="bi bi-calendar3"></i> {{ lang === 'vi' ? 'Ngày phát hành' : 'Release Date' }}</div>
            <div class="about-value">2025-12-28</div>
          </div>
          <div class="about-item">
            <div class="about-label"><i class="bi bi-person-circle"></i> {{ lang === 'vi' ? 'Phát triển bởi' : 'Developed by' }}</div>
            <div class="about-value">KDone Team</div>
          </div>
          <div class="about-item">
            <div class="about-label"><i class="bi bi-github"></i> Repository</div>
            <div class="about-value"><a href="https://github.com/polo33333/deploy-manager" target="_blank" class="repo-link">github.com/polo33333/deploy-manager</a></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `
}).mount("#app");

