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
  // Include currency so we can store it on the snapshot for historical accuracy
  const { data: portfolios, error: portError } = await supabase
    .from('portfolios')
    .select('id, currency, holdings(symbol, current_value, quantity, asset_type, metadata)')

  if (portError || !portfolios || portfolios.length === 0) {
    return new Response(JSON.stringify({ snapshots: 0 }), { headers: CORS })
  }

  const today = new Date().toISOString().split('T')[0]

  // ── Portfolio snapshots ────────────────────────────────────────────────────
  // Stores equity (not gross value) to match the Dashboard Net Worth stat card.
  // Real estate equity = current_value - mortgage_balance - heloc_balance.
  type HoldingRow = {
    symbol: string | null
    current_value: number
    quantity: number
    asset_type: string
    metadata: Record<string, unknown> | null
  }

  function holdingEquity(h: HoldingRow): number {
    if (h.asset_type === 'real_estate') {
      const mortgage = Number(h.metadata?.mortgage_balance ?? 0)
      const heloc    = Number(h.metadata?.heloc_balance    ?? 0)
      return (h.current_value ?? 0) - mortgage - heloc
    }
    return h.current_value ?? 0
  }

  const snapshots = portfolios.map((p: { id: string; currency: string; holdings: HoldingRow[] }) => ({
    portfolio_id: p.id,
    snapshot_date: today,
    total_value: p.holdings.reduce((s, h) => s + holdingEquity(h), 0),
    currency: p.currency,
    breakdown: {},
  }))

  const { error: snapError } = await supabase
    .from('portfolio_snapshots')
    .upsert(snapshots, { onConflict: 'portfolio_id,snapshot_date' })

  if (snapError) {
    return new Response(JSON.stringify({ error: snapError.message }), { status: 500, headers: CORS })
  }

  // ── Stock price history — EOD closing price per symbol ────────────────────
  // Collect unique symbols with a price (current_value / quantity = per-share price)
  const priceMap = new Map<string, number>()
  for (const portfolio of portfolios) {
    for (const h of (portfolio as { holdings: { symbol: string | null; current_value: number; quantity: number; asset_type: string }[] }).holdings) {
      if (h.symbol && h.quantity > 0 && !priceMap.has(h.symbol)) {
        priceMap.set(h.symbol, h.current_value / h.quantity)
      }
    }
  }

  if (priceMap.size > 0) {
    const priceRows = Array.from(priceMap.entries()).map(([symbol, price]) => ({
      symbol,
      price,
      date: today,
    }))
    await supabase
      .from('stock_price_history')
      .upsert(priceRows, { onConflict: 'symbol,date' })
  }

  return new Response(
    JSON.stringify({ snapshots: snapshots.length, priceHistory: priceMap.size, date: today }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
