// ============================================================
// modal.js — Sistema de modales
// ============================================================
const Modal = (() => {
    let overlay = null;

    function getOverlay() {
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-overlay';
            overlay.addEventListener('click', e => {
                if (e.target === overlay) close();
            });
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    function open({ title, body, size = 'md', footer = '' }) {
        const o = getOverlay();
        o.innerHTML = `
            <div class="modal modal-${size}">
                <div class="modal-header">
                    <h3 class="modal-title">${Utils.escape(title)}</h3>
                    <button class="modal-close-btn" onclick="Modal.close()">${Utils.icon('close', 20)}</button>
                </div>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;
        o.classList.add('modal-overlay-show');
        document.body.classList.add('modal-open');

        // Focus primer input
        setTimeout(() => {
            const first = o.querySelector('input:not([type=hidden]), select, textarea');
            if (first) first.focus();
        }, 50);
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('modal-overlay-show');
            document.body.classList.remove('modal-open');
        }
        // Limpiar listeners de dropdowns de producto
        if (VentasController?._cerrarDropdownHandler)
            document.removeEventListener('mousedown', VentasController._cerrarDropdownHandler);
        if (ComprasController?._cerrarDropdownHandler)
            document.removeEventListener('mousedown', ComprasController._cerrarDropdownHandler);
    }

    // Modal de confirmación
    function confirm({ title = '¿Confirmar?', message, onConfirm, danger = false }) {
        open({
            title,
            size: 'sm',
            body: `<p class="confirm-message">${Utils.escape(message)}</p>`,
            footer: `
                <button class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
                <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">Confirmar</button>
            `
        });
        document.getElementById('confirm-ok-btn').addEventListener('click', () => {
            close();
            if (typeof onConfirm === 'function') onConfirm();
        });
    }

    return { open, close, confirm };
})();
