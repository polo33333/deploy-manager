// app.js
const { createApp, ref, onMounted } = Vue;

createApp({
  data() {
    return {
      theme: localStorage.getItem("theme") || "light",
      token: localStorage.getItem("token") || null,
      username: "",
      password: "",
      loggedInUser: localStorage.getItem("username") || "",
      apps: [],
      config: {},
      form: { name: "", repo: "", branch: "main", port: 3001, pm2: "" },
      loading: false,
      loginLoading: false,
      loginError: null,
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
      const r = await axios.get("/api/apps", { headers: this.authHeader() });
      this.apps = r.data;
    },
    async fetchConfig() {
      if (!this.token) return;
      const r = await axios.get("/api/config", { headers: this.authHeader() });
      this.config = r.data;
    },
    async addApp() {
      if (!this.token) return alert("Login required");
      this.loading = true;
      try {
        await axios.post("/api/add-app", this.form, { headers: this.authHeader() });
        alert("Deploy started");
        await this.fetchApps();
        await this.fetchConfig();
      } catch (e) {
        alert("Add app failed: " + (e.response?.data?.error || e.message));
      } finally { this.loading = false; }
    },
    async deploy(name) {
      await axios.post("/api/deploy", { name }, { headers: this.authHeader() });
      setTimeout(()=>this.fetchApps(), 1500);
    },
    async restart(name) {
      await axios.post("/api/restart", { name }, { headers: this.authHeader() });
      setTimeout(()=>this.fetchApps(), 1000);
    },
    async stop(name) {
      await axios.post("/api/stop", { name }, { headers: this.authHeader() });
      setTimeout(()=>this.fetchApps(), 1000);
    },
    async remove(name) {
      if (!confirm("Remove app from PM2 and config?")) return;
      await axios.delete("/api/remove", { data: { name }, headers: this.authHeader() });
      setTimeout(()=>{ this.fetchApps(); this.fetchConfig(); }, 1000);
    },
    async viewLogs(name) {
      const r = await axios.get(`/api/logs/${name}?lines=200`, { headers: this.authHeader() });
      const win = window.open("", "_blank");
      win.document.write(`<pre>${r.data.replace(/</g,"&lt;")}</pre>`);
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
    if (this.token) {
      this.fetchApps();
      this.fetchConfig();
    }
  },
  template: `
  <div class="wrap">
    <div class="top"><h1>Auto Deploy Dashboard</h1></div>
 
    <div v-if="!token" class="card">
      <h3>Login</h3>
      <form @submit.prevent="login">
        <input v-model="username" placeholder="username" required @keyup.enter="login" />
        <input v-model="password" type="password" placeholder="password" required @keyup.enter="login" />
        <button type="submit" :disabled="loginLoading">{{ loginLoading ? 'Logging in...' : 'Login' }}</button>
        <p v-if="loginError" style="color: red; margin-top: 8px;">{{ loginError }}</p>
      </form>
    </div>
    <div v-else>
      <div class="top">
        <div>Logged in as <b>{{loggedInUser}}</b></div>
        <div>
          <button @click="logout">Logout</button>
          <button @click="toggleTheme" class="theme-toggle-button">Toggle Theme</button>
        </div>
      </div>

      <div class="card">
        <h3>Add New App</h3>
        <input v-model="form.name" placeholder="app name (folder & pm2 name)" />
        <input v-model="form.repo" placeholder="git repo url" />
        <input v-model="form.branch" placeholder="branch" />
        <input v-model.number="form.port" placeholder="port" type="number" />
        <input v-model="form.pm2" placeholder="pm2 name (optional)" />
        <button @click="addApp" :disabled="loading">Add & Deploy</button>
      </div>

      <div class="card">
        <h3>Managed Apps</h3>
        <button @click="fetchApps">Refresh</button>
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Port</th><th>PM2 name</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-for="app of apps" :key="app.name">
              <td>{{app.name}}</td>
              <td>{{app.pm2_env.status}}</td>
              <td>{{ app.pm2_env.env && app.pm2_env.env.PORT ? app.pm2_env.env.PORT : (config[app.name] && config[app.name].port) }}</td>
              <td>{{app.name}}</td>
              <td>
                <button @click="deploy(app.name)">Deploy</button>
                <button @click="restart(app.name)">Restart</button>
                <button @click="stop(app.name)">Stop</button>
                <button @click="viewLogs(app.name)">Logs</button>
                <button @click="remove(app.name)">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `
}).mount("#app");
