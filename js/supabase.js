// =========================================================
// DEV HUB — Configuração central do Supabase
// =========================================================

const SUPABASE_URL =
    'https://dgtyllwfzpiyxkeltxmi.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_fDh4lu5aH29N3GWm784KxA_LBLpTcKs';

// Expõe globalmente — usado pelo scanner-modal.js
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY;
window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;

if (
    !window.supabase ||
    typeof window.supabase.createClient !== 'function'
) {
    console.error('[DEV HUB] SDK do Supabase não foi carregado.');
    window.db = null;
    window.devHubSupabase = null;
} else {
    try {
        const client = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storageKey: 'dev-hub-auth'
                }
            }
        );

        window.db = client;
        window.devHubSupabase = client;
        window.DEV_HUB_CONFIGURED = true;

        console.log('[DEV HUB] Supabase conectado com sucesso.');
    } catch (error) {
        console.error('[DEV HUB] Erro ao inicializar Supabase:', error);
        window.db = null;
        window.devHubSupabase = null;
        window.DEV_HUB_CONFIGURED = false;
    }
}