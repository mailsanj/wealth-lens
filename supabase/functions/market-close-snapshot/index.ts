import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Prices are kept current by the 15-min refresh-prices cron throughout the day.
  // By 4:30 PM ET (when this runs), holdings are at most ~30 min stale — no need
  // to call refresh-prices here, which would only update 8 of N symbols anyway.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Single query: fetch all portfolios with their holdings in one round-trip
  const { data: portfolios, error: portError } = await supabase
    .from('portfolios')
    .select('id, holdings(current_value)')

  if (portError || !portfolios || portfolios.length === 0) {
    return new Response(JSON.stringify({ snapshots: 0 }), { headers: CORS })
  }

  const today = new Date().toISOString().split('T')[0]
  const snapshots = portfolios.map((p: { id: string; holdings: { current_value: number }[] }) => ({
    portfolio_id: p.id,
    snapshot_date: today,
    total_value: p.holdings.reduce((s, h) => s + (h.current_value ?? 0), 0),
    breakdown: {},
  }))

  // Upsert snapshots (one per portfolio per day)
  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert(snapshots, { onConflict: 'portfolio_id,snapshot_date' })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
  }

  return new Response(
    JSON.stringify({ snapshots: snapshots.length, date: today }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
