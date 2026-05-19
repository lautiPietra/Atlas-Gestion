// ============================================================
// router.js — SPA Hash Router
// ============================================================
const Router = (() => {
    const routes = {};
    let currentRoute = null;

    function register(path, controller) {
        routes[path] = controller;
    }

    async function navigate(path) {
        if (!path || path === '') path = '/dashboard';

        const isAuth = await Auth.isAuthenticated();
        if (!isAuth && path !== '/login') {
            window.location.hash = '#/login';
            return;
        }
        if (isAuth && path === '/login') {
            window.location.hash = '#/dashboard';
            return;
        }

        const controller = routes[path];
        if (!controller) {
            console.warn(`Ruta no encontrada: ${path}`);
            window.location.hash = '#/dashboard';
            return;
        }

        currentRoute = path;
        updateNav(path);

        const view = document.getElementById('app-view');
        if (view) {
            view.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
            try {
                await controller.render(view);
            } catch (err) {
                console.error('Error al renderizar:', err);
                view.innerHTML = `<div class="page-error"><h3>Error al cargar</h3><p>${Utils.escape(err.message)}</p></div>`;
            }
        }
    }

    function updateNav(path) {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.route === path);
        });
    }

    function handleHash() {
        const hash = window.location.hash.replace('#', '') || '/dashboard';
        navigate(hash);
    }

    function init() {
        window.addEventListener('hashchange', handleHash);
        handleHash();
    }

    return { register, navigate, init, getCurrent: () => currentRoute };
})();
