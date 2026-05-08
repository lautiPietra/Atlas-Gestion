// ============================================================
// utils.js - Helpers de formato y utilidades
// ============================================================
const Utils = {
    INACTIVE_MARKER: '__ATLAS_INACTIVO__',

    currency(n) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency', currency: 'ARS', minimumFractionDigits: 2
        }).format(parseFloat(n) || 0);
    },

    number(n) { return new Intl.NumberFormat('es-AR').format(n || 0); },

    date(str) {
        if (!str) return '-';
        // DATE-only strings (YYYY-MM-DD) must be parsed as local time to avoid UTC-midnight timezone shift
        const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    datetime(str) {
        if (!str) return '-';
        return new Date(str).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    },

    escape(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    statusBadge(estado) {
        const map = {
            completada: 'success', pendiente: 'warning', cancelada: 'danger',
            recibida: 'success', enviada: 'info', entrada: 'success',
            salida: 'danger', ajuste: 'warning', activo: 'success', inactivo: 'danger'
        };
        return `<span class="badge badge-${map[estado] || 'default'}">${Utils.escape(estado)}</span>`;
    },

    truncate(str, n = 35) {
        if (!str) return '-';
        return str.length > n ? str.substring(0, n) + '...' : str;
    },

    debounce(fn, delay = 350) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
    },

    csvCell(value) {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
    },

    // Returns the canonical business date for a row: fecha if set, else created_at converted to local timezone
    effectiveDate(row) {
        if (row.fecha) return row.fecha;
        if (!row.created_at) return null;
        const d = new Date(row.created_at);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    },

    // PostgREST `or` filter: match by fecha column OR fall back to created_at for null-fecha records
    buildDateOrFilter(start, end) {
        const [y, m, d] = end.split('-').map(Number);
        const nextDt = new Date(y, m - 1, d + 1);
        const pad = n => String(n).padStart(2, '0');
        const nxt = `${nextDt.getFullYear()}-${pad(nextDt.getMonth()+1)}-${pad(nextDt.getDate())}`;
        if (start === end) {
            return `(fecha.eq.${start},and(fecha.is.null,created_at.gte.${start},created_at.lt.${nxt}))`;
        }
        return `(and(fecha.gte.${start},fecha.lte.${end}),and(fecha.is.null,created_at.gte.${start},created_at.lt.${nxt}))`;
    },

    normalizeText(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    },

    hasInactiveMarker(value) {
        return String(value ?? '').includes(Utils.INACTIVE_MARKER);
    },

    withInactiveMarker(value, inactive = false) {
        const clean = Utils.stripInactiveMarker(value);
        return inactive ? `${Utils.INACTIVE_MARKER}\n${clean}`.trim() : clean;
    },

    stripInactiveMarker(value) {
        return String(value ?? '')
            .replace(Utils.INACTIVE_MARKER, '')
            .replace(/^\s*\n/, '')
            .trim();
    },

    buildTable(cols, rows, emptyMsg = 'Sin registros') {
        if (!rows || rows.length === 0) {
            return `<div class="empty-state"><span class="empty-icon">Lista</span><p>${emptyMsg}</p></div>`;
        }
        const thead = cols.map(c => `<th>${c.label}</th>`).join('');
        const tbody = rows.map(r => {
            const cells = cols.map(c => {
                const val = typeof c.render === 'function' ? c.render(r) : Utils.escape(r[c.key] ?? '-');
                return `<td>${val}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<table class="table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
    },

    icon(name, size = 18) {
        const icons = {
            plus:    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
            edit:    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            trash:   `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
            eye:     `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
            search:  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
            refresh: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
            download:`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
            close:   `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        };
        return icons[name] || '';
    }
};

// ============================================================
// WorkDate — Fecha de trabajo global (persiste en localStorage)
// ============================================================
const WorkDate = (() => {
    const KEY = 'atlas_workdate';
    const pad = n => String(n).padStart(2, '0');

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    }

    function get() {
        return localStorage.getItem(KEY) || todayStr();
    }

    function set(dateStr) {
        if (!dateStr) return;
        if (dateStr === todayStr()) localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, dateStr);
        _updateTopbar();
    }

    function reset() {
        localStorage.removeItem(KEY);
        _updateTopbar();
    }

    function prev() {
        const [y, m, d] = get().split('-').map(Number);
        const dt = new Date(y, m - 1, d - 1);
        set(`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`);
    }

    function next() {
        const [y, m, d] = get().split('-').map(Number);
        const dt = new Date(y, m - 1, d + 1);
        set(`${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`);
    }

    function isToday() {
        return get() === todayStr();
    }

    // ISO string con la hora actual pero en la fecha de trabajo, con offset local explícito
    function toISO() {
        const now = new Date();
        const [y, m, d] = get().split('-').map(Number);
        const o = now.getTimezoneOffset();
        const sign = o <= 0 ? '+' : '-';
        const abs = Math.abs(o);
        const tzOff = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
        return `${y}-${pad(m)}-${pad(d)}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tzOff}`;
    }

    function _updateTopbar() {
        const input = document.getElementById('workdate-input');
        if (input) input.value = get();
        const todayBtn = document.getElementById('workdate-today-btn');
        if (todayBtn) todayBtn.style.display = isToday() ? 'none' : '';
        const wrapper = document.getElementById('workdate-wrapper');
        if (wrapper) wrapper.style.color = isToday() ? '' : '#d97706';
    }

    return { get, set, reset, prev, next, isToday, toISO };
})();
