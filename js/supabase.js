// ============================================================
// supabase.js — Cliente REST para Supabase (sin SDK)
// ============================================================
const SupabaseClient = (() => {
    // Tablas que requieren aislamiento por usuario
    const TENANT_TABLES = new Set([
        'productos', 'categorias', 'clientes', 'proveedores',
        'ventas', 'compras', 'stock_movimientos'
    ]);

    const getHeaders = () => ({
        'apikey':        CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${localStorage.getItem('supabase_token') || CONFIG.SUPABASE_ANON_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation'
    });

    const BASE = () => `${CONFIG.SUPABASE_URL}/rest/v1`;

    function getCurrentUserId() {
        try {
            const token = localStorage.getItem('supabase_token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload.user_id || null;
        } catch { return null; }
    }

    function buildQuery(params = {}) {
        const parts = [];
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) {
                if (Array.isArray(v)) {
                    v.forEach(val => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(val)}`));
                } else {
                    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
                }
            }
        }
        return parts.length ? '?' + parts.join('&') : '';
    }

    function friendlyError(status, err) {
        const code = err.code || '';
        if (code === '23503' || status === 409) return 'No se puede realizar la operacion porque existen registros relacionados.';
        if (code === '23505') return 'Ya existe un registro con ese valor (duplicado).';
        if (code === '23502') return 'Faltan campos obligatorios.';
        if (code === '42501' || status === 403) return 'Sin permisos para realizar esta operacion.';
        if (status === 401) return 'Sesion expirada. Por favor vuelve a iniciar sesion.';
        if (status >= 500) return 'Error del servidor. Intentalo de nuevo.';
        return err.message || `Error HTTP ${status}`;
    }

    async function request(method, path, body = null, params = {}) {
        const url = `${BASE()}/${path}${buildQuery(params)}`;
        const opts = { method, headers: getHeaders() };
        if (body !== null) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(friendlyError(res.status, err));
        }
        const text = await res.text();
        return text ? JSON.parse(text) : [];
    }

    return {
        async select(table, params = {}) {
            if (!params.select) params.select = '*';
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) params.user_id = `eq.${uid}`;
            }
            return request('GET', table, null, params);
        },

        async selectOne(table, id) {
            const params = { select: '*', id: `eq.${id}` };
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) params.user_id = `eq.${uid}`;
            }
            const rows = await request('GET', table, null, params);
            return rows[0] || null;
        },

        async insert(table, data) {
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) data = { ...data, user_id: uid };
            }
            return request('POST', table, data);
        },

        async update(table, id, data) {
            const params = { id: `eq.${id}` };
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) params.user_id = `eq.${uid}`;
            }
            return request('PATCH', table, data, params);
        },

        // Como update() pero con condiciones extra en el WHERE.
        // Retorna array vacío si ninguna fila coincidió (lock optimista falló).
        async updateIf(table, id, data, conditions = {}) {
            const params = { id: `eq.${id}` };
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) params.user_id = `eq.${uid}`;
            }
            for (const [k, v] of Object.entries(conditions)) params[k] = v;
            return request('PATCH', table, data, params);
        },

        async delete(table, id) {
            let qs = `id=eq.${id}`;
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) qs += `&user_id=eq.${uid}`;
            }
            const res = await fetch(`${BASE()}/${table}?${qs}`, { method: 'DELETE', headers: getHeaders() });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(friendlyError(res.status, err));
            }
            return true;
        },

        async deleteWhere(table, field, value) {
            let qs = `${field}=eq.${value}`;
            if (TENANT_TABLES.has(table)) {
                const uid = getCurrentUserId();
                if (uid) qs += `&user_id=eq.${uid}`;
            }
            const res = await fetch(`${BASE()}/${table}?${qs}`, { method: 'DELETE', headers: getHeaders() });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(friendlyError(res.status, err));
            }
            return true;
        }
    };
})();
