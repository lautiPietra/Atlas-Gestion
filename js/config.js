// ============================================================
// config.js — Lee credenciales desde env-config.js (generado)
// Para regenerar localmente: node scripts/build-env.js
// ============================================================
const CONFIG = (() => {
    const env = window.ENV_CONFIG;
    if (!env || !env.SUPABASE_URL) {
        console.error(
            '[CONFIG] env-config.js no cargado o incompleto.\n' +
            'Ejecutá: node scripts/build-env.js'
        );
    }
    return {
        ATLAS_API_URL:     (env && env.ATLAS_API_URL)     || '',
        SUPABASE_URL:      (env && env.SUPABASE_URL)      || '',
        SUPABASE_ANON_KEY: (env && env.SUPABASE_ANON_KEY) || '',

        APP_NAME:    'Pietra Cloud',
        VERSION:     '1.0.0',
        STOCK_MINIMO: 5
    };
})();
