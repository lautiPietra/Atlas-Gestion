// ============================================================
// scripts/build-env.js
// Genera js/env-config.js a partir de variables de entorno.
//
// Uso local:  node scripts/build-env.js  (lee .env automáticamente)
// Netlify:    se ejecuta con las env vars del dashboard
// ============================================================
const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// Cargar .env si existe (desarrollo local)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
    fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const eq = line.indexOf('=');
        if (eq < 0) return;
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key && !(key in process.env)) process.env[key] = val;
    });
}

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
    console.error('[build-env] Faltan variables de entorno:', missing.join(', '));
    console.error('[build-env] Copia .env.example a .env y completá los valores.');
    process.exit(1);
}

const cfg = {
    SUPABASE_URL:      process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

const out = `// AUTO-GENERADO — no editar manualmente.
// Para regenerar: node scripts/build-env.js
window.ENV_CONFIG = ${JSON.stringify(cfg, null, 4)};
`;

fs.writeFileSync(path.join(root, 'js', 'env-config.js'), out);
console.log('[build-env] js/env-config.js generado correctamente.');
