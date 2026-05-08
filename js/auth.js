// ============================================================
// auth.js — Autenticación con JWT (Web Crypto API nativa)
// ============================================================
const Auth = (() => {
    const TOKEN_KEY = 'atlas_token';
    const USER_KEY  = 'atlas_user';

    function b64url(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, p) => String.fromCharCode(parseInt(p, 16))))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    function b64urlDecode(str) {
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        return decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    }

    async function hashPassword(password) {
        const enc = new TextEncoder();
        const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function hmacSign(data, secret) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', enc.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
        return btoa(String.fromCharCode(...new Uint8Array(sig)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    async function createToken(payload) {
        const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const body   = b64url(JSON.stringify({
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
        }));
        const sig = await hmacSign(`${header}.${body}`, CONFIG.JWT_SECRET);
        return `${header}.${body}.${sig}`;
    }

    async function verifyToken(token) {
        if (!token) return null;
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const [header, body, sig] = parts;
            const expectedSig = await hmacSign(`${header}.${body}`, CONFIG.JWT_SECRET);
            if (sig !== expectedSig) return null;
            const payload = JSON.parse(b64urlDecode(body));
            if (payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        } catch {
            return null;
        }
    }

    return {
        async login(username, password) {
            try {
                const users = await SupabaseClient.select('users', {
                    select: 'id,username,name,role',
                    username: `eq.${username}`,
                    password: `eq.${password}`,
                    limit: 1
                });
                if (!users || users.length === 0) throw new Error('Usuario o contraseña incorrectos');
                const user = users[0];
                const token = await createToken({ id: user.id, username: user.username, name: user.name, role: user.role });
                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(USER_KEY, JSON.stringify(user));
                return { success: true, user };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },

        logout() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.hash = '#/login';
            location.reload();
        },

        async isAuthenticated() {
            const token = localStorage.getItem(TOKEN_KEY);
            if (!token) return false;
            return !!(await verifyToken(token));
        },

        getUser() {
            try { return JSON.parse(localStorage.getItem(USER_KEY)); }
            catch { return null; }
        },

        getToken() { return localStorage.getItem(TOKEN_KEY); }
    };
})();
