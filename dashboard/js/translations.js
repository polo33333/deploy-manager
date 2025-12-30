// translations.js
// Multi-language support for ServerHub Dashboard

const translations = {
    en: {
        // Login
        loginTitle: "Welcome Back",
        loginSubtitle: "Sign in to manage your applications",
        username: "Username",
        password: "Password",
        rememberMe: "Remember me",
        signIn: "Sign In",
        loggingIn: "Logging in...",
        loginFailed: "Login failed. Please try again.",
        logoutConfirm: "Are you sure you want to logout?",

        // Header
        appTitle: "ServerHub",
        loggedInAs: "Logged in as",
        logout: "Logout",

        // Tabs
        tabHome: "Home",
        tabDeploy: "Deploy Apps",
        tabSystem: "System",
        tabAbout: "About",

        // System Monitor
        systemMonitor: "System Monitor",
        systemMonitorDesc: "Real-time system resource usage",
        cpuUsage: "CPU Usage",
        memoryUsage: "Memory Usage",
        cpuTemp: "CPU Temperature",
        fanSpeed: "Fan Speed",
        networkSpeed: "Network Speed",
        downloadSpeed: "Download",
        uploadSpeed: "Upload",
        connections: "Connections",
        cores: "cores",
        host: "Host",
        uptime: "Uptime",
        loadAvg: "Load Avg",
        loadingStats: "Loading system stats...",
        max: "Max",

        // Applications Status
        appsStatus: "Applications Status",
        appsStatusDesc: "Overview of managed applications",
        runningApps: "Running Apps",
        totalApps: "Total Apps",
        activeApps: "Active applications",
        managedByPM2: "Managed by PM2",
        statusDistribution: "Status Distribution",
        total: "total",
        online: "Online",
        stopped: "Stopped",
        other: "Other",

        // Deploy Apps
        addNewApp: "Add New Application",
        appName: "App Name",
        gitRepo: "Git Repository URL",
        branch: "Branch",
        pm2Name: "PM2 Name (optional)",
        pm2NameTable: "PM2 Name",
        pm2NamePlaceholder: "Leave empty to use app name",
        startScript: "Start Script (optional)",
        startScriptPlaceholder: "e.g., app.js or npm -- start",
        addDeploy: "Add & Deploy",
        adding: "Adding...",

        managedApps: "Managed Applications",
        refresh: "Refresh",
        name: "Name",
        status: "Status",
        port: "Port",
        autoRestart: "Auto Restart",
        actions: "Actions",
        deploy: "Deploy",
        restart: "Restart",
        stop: "Stop",
        logs: "Logs",
        remove: "Remove",
        yes: "Yes",
        no: "No",
        noApps: "No applications found. Add your first app above!",

        // System Control
        adguardHome: "AdGuard Home",
        adguardDesc: "Update AdGuard Home to the latest version",
        updateAdguard: "Update AdGuard Home",
        updating: "Updating...",

        hostControl: "Host Control",
        hostControlDesc: "Control the host machine",
        rebootHost: "Reboot Host",
        shutdownHost: "Shutdown Host",

        // Tooltips
        deployLatest: "Deploy latest changes",
        restartApp: "Restart application",
        stopApp: "Stop application",
        viewLogs: "View logs",
        removeApp: "Remove application"
    },
    vi: {
        // Login
        loginTitle: "Chào Mừng Trở Lại",
        loginSubtitle: "Đăng nhập để quản lý ứng dụng",
        username: "Tên đăng nhập",
        password: "Mật khẩu",
        rememberMe: "Ghi nhớ đăng nhập",
        signIn: "Đăng Nhập",
        loggingIn: "Đang đăng nhập...",
        loginFailed: "Đăng nhập thất bại. Vui lòng thử lại.",
        logoutConfirm: "Bạn có chắc chắn muốn đăng xuất?",

        // Header
        appTitle: "ServerHub",
        loggedInAs: "Đã đăng nhập với tên",
        logout: "Đăng Xuất",

        // Tabs
        tabHome: "Trang Chủ",
        tabDeploy: "Triển Khai Ứng Dụng",
        tabSystem: "Hệ Thống",
        tabAbout: "Thông Tin",

        // System Monitor
        systemMonitor: "Giám Sát Hệ Thống",
        systemMonitorDesc: "Theo dõi tài nguyên hệ thống theo thời gian thực",
        cpuUsage: "Sử Dụng CPU",
        memoryUsage: "Sử Dụng Bộ Nhớ",
        cpuTemp: "Nhiệt Độ CPU",
        fanSpeed: "Tốc Độ Quạt",
        networkSpeed: "Tốc Độ Mạng",
        downloadSpeed: "Tải Xuống",
        uploadSpeed: "Tải Lên",
        connections: "Kết Nối",
        cores: "lõi",
        host: "Máy chủ",
        uptime: "Thời gian hoạt động",
        loadAvg: "Tải trung bình",
        loadingStats: "Đang tải thông tin hệ thống...",
        max: "Tối đa",

        // Applications Status
        appsStatus: "Trạng Thái Ứng Dụng",
        appsStatusDesc: "Tổng quan các ứng dụng đang quản lý",
        runningApps: "Ứng Dụng Đang Chạy",
        totalApps: "Tổng Số Ứng Dụng",
        activeApps: "Ứng dụng đang hoạt động",
        managedByPM2: "Được quản lý bởi PM2",
        statusDistribution: "Phân Bố Trạng Thái",
        total: "tổng",
        online: "Đang chạy",
        stopped: "Đã dừng",
        other: "Khác",

        // Deploy Apps
        addNewApp: "Thêm Ứng Dụng Mới",
        appName: "Tên Ứng Dụng",
        gitRepo: "URL Repository Git",
        branch: "Nhánh",
        pm2Name: "Tên PM2 (tùy chọn)",
        pm2NameTable: "Tên PM2",
        pm2NamePlaceholder: "Để trống để dùng tên ứng dụng",
        startScript: "Script Khởi Động (tùy chọn)",
        startScriptPlaceholder: "VD: app.js hoặc npm -- start",
        addDeploy: "Thêm & Triển Khai",
        adding: "Đang thêm...",

        managedApps: "Ứng Dụng Đang Quản Lý",
        refresh: "Làm Mới",
        name: "Tên",
        status: "Trạng Thái",
        port: "Cổng",
        autoRestart: "Tự Động Khởi Động Lại",
        actions: "Thao Tác",
        deploy: "Triển Khai",
        restart: "Khởi Động Lại",
        stop: "Dừng",
        logs: "Nhật Ký",
        remove: "Xóa",
        yes: "Có",
        no: "Không",
        noApps: "Không tìm thấy ứng dụng nào. Hãy thêm ứng dụng đầu tiên!",

        // System Control
        adguardHome: "AdGuard Home",
        adguardDesc: "Cập nhật AdGuard Home lên phiên bản mới nhất",
        updateAdguard: "Cập Nhật AdGuard Home",
        updating: "Đang cập nhật...",

        hostControl: "Điều Khiển Máy Chủ",
        hostControlDesc: "Điều khiển máy chủ host",
        rebootHost: "Khởi Động Lại Máy Chủ",
        shutdownHost: "Tắt Máy Chủ",

        // Tooltips
        deployLatest: "Triển khai phiên bản mới nhất",
        restartApp: "Khởi động lại ứng dụng",
        stopApp: "Dừng ứng dụng",
        viewLogs: "Xem nhật ký",
        removeApp: "Xóa ứng dụng"
    }
};
