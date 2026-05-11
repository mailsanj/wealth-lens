import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Using untyped client until Supabase CLI generates types from the live schema.
// Replace with createClient<Database>(...) after running:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
