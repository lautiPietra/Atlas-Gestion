// ============================================================
// toast.js — Notificaciones tipo toast
// ============================================================
const Toast = (() => {
    let container = null;

    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    function show(message, type = 'info', duration = 3500) {
        const c = getContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${Utils.escape(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        c.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast-show'));

        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    return {
        success: (msg, d) => show(msg, 'success', d),
        error:   (msg, d) => show(msg, 'error', d || 5000),
        warning: (msg, d) => show(msg, 'warning', d),
        info:    (msg, d) => show(msg, 'info', d)
    };
})();
