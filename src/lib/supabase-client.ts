// ============================================================================
// Imports
// ============================================================================
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Configuratie uitlezen
// ============================================================================

// Lees de Supabase-credentials uit de omgevingsvariabelen (.env).
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Stop meteen met een duidelijke fout als een van beide ontbreekt, in plaats van later een
// cryptische fout te krijgen bij de eerste database-aanroep.
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht (.env).');
}

// ============================================================================
// Client aanmaken
// ============================================================================

// Eén gedeelde Supabase-client (met de service-role-key, dus alleen server-side gebruiken).
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
