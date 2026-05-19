// ============================================================
// auth.js — Autenticación via backend Atlas
// ============================================================
const Auth = (() => {
    const TOKEN_KEY = 'supabase_token';
    const USER_KEY  = 'atlas_user';

    // ── Rate limiting en memoria ─────────────────────────────
    const _rl = { count: 0, firstAt: 0 };
    const MAX_ATTEMPTS = 10;
    const LOCKOUT_MS   = 10 * 60 * 1000;

    function _isLockedOut() {
        if (_rl.count < MAX_ATTEMPTS) return false;
        if (Date.now() - _rl.firstAt > LOCKOUT_MS) { _rl.count = 0; _rl.firstAt = 0; return false; }
        return true;
    }
    function _lockoutMinutesLeft() {
        return Math.ceil((LOCKOUT_MS - (Date.now() - _rl.firstAt)) / 60000);
    }
    function _recordFail()    { if (_rl.count === 0) _rl.firstAt = Date.now(); _rl.count++; }
    function _resetAttempts() { _rl.count = 0; _rl.firstAt = 0; }

    // ── Validación de input ──────────────────────────────────
    function _validate(username, password) {
        if (!username || !username.trim()) return 'Ingresá tu usuario.';
        if (username.trim().length > 64)   return 'Usuario inválido.';
        if (!password)                      return 'Ingresá tu contraseña.';
        if (password.length > 128)          return 'Contraseña inválida.';
        return null;
    }

    // ── Verificación de expiración del supabase_token ────────
    function _tokenIsValid(token) {
        if (!token) return false;
        try {
            const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(b64));
            return payload.exp > Math.floor(Date.now() / 1000);
        } catch { return false; }
    }

    // ── Llamada al backend Atlas ─────────────────────────────
    // Usa path relativo → Netlify proxy reenvía a pietracloud.com.ar (sin CORS)
    async function _callAtlas(username, password) {
        const res = await fetch('/api/sistema/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username: username.trim(), password })
        });
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`El servidor respondió con error ${res.status}. Revisá los logs del backend.`);
        }
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        return data;
    }

    // ── API pública ──────────────────────────────────────────
    return {
        async login(username, password) {
            if (_isLockedOut())
                return { success: false, error: `Demasiados intentos. Esperá ${_lockoutMinutesLeft()} min.` };

            const validationErr = _validate(username, password);
            if (validationErr) return { success: false, error: validationErr };

            try {
                const { ok, user } = await _callAtlas(username, password);
                if (!ok) return { success: false, error: 'Usuario o contraseña incorrectos.' };

                _resetAttempts();

                const userData = {
                    id:           user.user_id,
                    atlas_id:     user.id,
                    username:     user.username,
                    name:         user.username,
                    product_name: user.product_name,
                    purchase_id:  user.purchase_id,
                    role:         'user'
                };

                localStorage.setItem(USER_KEY, JSON.stringify(userData));
                if (user.supabase_token)
                    localStorage.setItem(TOKEN_KEY, user.supabase_token);

                return { success: true, user: userData };

            } catch (e) {
                _recordFail();
                const left = MAX_ATTEMPTS - _rl.count;
                const warn = left > 0 ? ` (${left} intento${left !== 1 ? 's' : ''} restante${left !== 1 ? 's' : ''})` : '';
                return { success: false, error: (e.message || 'Error de conexión.') + warn };
            }
        },

        logout() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem('atlas_token');
            window.location.hash = '#/login';
            location.reload();
        },

        isAuthenticated() {
            return _tokenIsValid(localStorage.getItem(TOKEN_KEY));
        },

        getUser() {
            try { return JSON.parse(localStorage.getItem(USER_KEY)); }
            catch { return null; }
        },

        getToken() { return localStorage.getItem(TOKEN_KEY); }
    };
})();
