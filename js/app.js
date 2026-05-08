// ============================================================
// app.js — Inicialización de la aplicación
// ============================================================
const App = (() => {
    const NAV_ITEMS = [
        { route: '/dashboard',   label: 'Dashboard',    icon: '▣' },
        { route: '/productos',   label: 'Productos',    icon: '◈' },
        { route: '/stock',       label: 'Stock',        icon: '≡' },
        { route: '/ventas',      label: 'Ventas',       icon: '◎' },
        { route: '/compras',     label: 'Compras',      icon: '◒' },
        { route: '/clientes',    label: 'Clientes',     icon: '◉' },
        { route: '/proveedores', label: 'Proveedores',  icon: '◫' },
        { route: '/reportes',    label: 'Reportes',     icon: '◰' }
    ];

    function renderApp(user) {
        const navItems = NAV_ITEMS.map(n => `
            <li class="nav-item" data-route="${n.route}" onclick="Router.navigate('${n.route}'); App.closeMobile();">
                <span class="nav-icon">${n.icon}</span>
                <span class="nav-label">${n.label}</span>
            </li>
        `).join('');

        document.getElementById('root').innerHTML = `
            <div class="layout">
                <aside class="sidebar" id="sidebar">
                    <div class="sidebar-logo">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                            <polygon points="18,3 33,30 3,30" fill="white"/>
                            <polygon points="18,11 26,26 10,26" fill="#0a0a0a"/>
                        </svg>
                        <div class="sidebar-logo-text">
                            <span class="logo-name">PIETRA</span>
                            <span class="logo-sub">Cloud</span>
                        </div>
                    </div>
                    <nav class="sidebar-nav">
                        <ul>${navItems}</ul>
                    </nav>
                    <div class="sidebar-user">
                        <div class="user-avatar">${user.name ? user.name[0].toUpperCase() : 'U'}</div>
                        <div class="user-info">
                            <span class="user-name">${Utils.escape(user.name || user.username)}</span>
                            <span class="user-role">${Utils.escape(user.role || 'user')}</span>
                        </div>
                        <button class="btn-logout" onclick="Auth.logout()" title="Cerrar sesión">⏻</button>
                    </div>
                </aside>
                <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="App.closeMobile()"></div>
                <main class="main-content">
                    <header class="topbar">
                        <button class="hamburger" onclick="App.toggleMobile()" aria-label="Menu">
                            <span></span><span></span><span></span>
                        </button>
                        <div class="topbar-right"></div>
                    </header>
                    <div class="page-wrapper">
                        <div id="app-view"></div>
                    </div>
                </main>
            </div>
        `;

        // Inicializar selector de fecha de trabajo
        const wdInput = document.getElementById('workdate-input');
        if (wdInput) {
            wdInput.value = WorkDate.get();
            const todayBtn = document.getElementById('workdate-today-btn');
            if (todayBtn) todayBtn.style.display = WorkDate.isToday() ? 'none' : '';
            const wrapper = document.getElementById('workdate-wrapper');
            if (wrapper) wrapper.style.color = WorkDate.isToday() ? '' : '#d97706';
        }
    }

    function renderLogin() {
        document.getElementById('root').innerHTML = `
            <div class="login-page">
                <div class="login-card">
                    <div class="login-logo">
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                            <polygon points="26,4 48,44 4,44" fill="#0a0a0a"/>
                            <polygon points="26,16 38,38 14,38" fill="white"/>
                        </svg>
                    </div>
                    <h1 class="login-title">PIETRA CLOUD</h1>
                    <p class="login-subtitle">Sistema de Gestión</p>
                    <form id="login-form" class="login-form" onsubmit="App.handleLogin(event)">
                        <div class="form-group">
                            <label class="form-label">Usuario</label>
                            <input type="text" id="login-username" class="form-input"
                                   placeholder="nombre de usuario" autocomplete="username" required/>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Contraseña</label>
                            <input type="password" id="login-password" class="form-input"
                                   placeholder="••••••••" autocomplete="current-password" required/>
                        </div>
                        <div id="login-error" class="login-error" style="display:none"></div>
                        <button type="submit" class="btn btn-primary btn-block" id="login-btn">
                            Ingresar
                        </button>
                    </form>
                </div>
            </div>
        `;
        document.getElementById('login-username').focus();
    }

    async function handleLogin(e) {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const errEl = document.getElementById('login-error');
        const username = document.getElementById('login-username').value.trim();
        const pass     = document.getElementById('login-password').value;

        btn.disabled = true;
        btn.textContent = 'Ingresando...';
        errEl.style.display = 'none';

        const result = await Auth.login(username, pass);
        if (result.success) {
            window.location.hash = '#/dashboard';
            location.reload();
        } else {
            errEl.textContent = result.error || 'Error al iniciar sesión';
            errEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Ingresar';
        }
    }

    function toggleMobile() {
        document.getElementById('sidebar').classList.toggle('sidebar-open');
        document.getElementById('sidebar-backdrop').classList.toggle('show');
    }

    function closeMobile() {
        document.getElementById('sidebar')?.classList.remove('sidebar-open');
        document.getElementById('sidebar-backdrop')?.classList.remove('show');
    }

    async function init() {
        const isAuth = await Auth.isAuthenticated();
        if (isAuth) {
            const user = Auth.getUser();
            renderApp(user);
            registerRoutes();
            Router.init();
        } else {
            renderLogin();
            window.location.hash = '#/login';
        }
    }

    function registerRoutes() {
        Router.register('/login',       { render: async () => { renderLogin(); } });
        Router.register('/dashboard',   DashboardController);
        Router.register('/productos',   ProductosController);
        Router.register('/stock',       StockController);
        Router.register('/ventas',      VentasController);
        Router.register('/compras',     ComprasController);
        Router.register('/clientes',    ClientesController);
        Router.register('/proveedores', ProveedoresController);
        Router.register('/reportes',    ReportesController);
    }

    return { init, handleLogin, toggleMobile, closeMobile };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
