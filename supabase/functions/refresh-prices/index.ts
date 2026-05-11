import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TWELVE_DATA_KEY = Deno.env.get('TWELVE_DATA_API_KEY') ?? ''
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), { status: 500, headers: CORS })
  }
  if (!TWELVE_DATA_KEY) {
    return new Response(JSON.stringify({ error: 'Missing TWELVE_DATA_API_KEY secret' }), { status: 500, headers: CORS })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Free tier: 8 credits/minute (1 per symbol).
  // Priority: never-refreshed holdings (NULL) first, then oldest-refreshed.
  // Two explicit queries avoids relying on NULLS FIRST support in the client.
  const BATCH_LIMIT = 8
  const baseQuery = () =>
    supabase
      .from('holdings')
      .select('id, symbol, asset_type, quantity')
      .not('symbol', 'is', null)
      .gt('quantity', 0)

  const { data: neverRefreshed, error: e1 } = await baseQuery()
    .is('last_price_updated_at', null)
    .limit(BATCH_LIMIT)

  if (e1) {
    return new Response(
      JSON.stringify({ error: e1.message, hint: e1.hint ?? null, code: e1.code ?? null }),
      { status: 500, headers: CORS }
    )
  }

  const slots = BATCH_LIMIT - (neverRefreshed?.length ?? 0)
  const { data: oldest, error: e2 } = slots > 0
    ? await baseQuery()
        .not('last_price_updated_at', 'is', null)
        .order('last_price_updated_at', { ascending: true })
        .limit(slots)
    : { data: [], error: null }

  if (e2) {
    return new Response(
      JSON.stringify({ error: e2.message, hint: e2.hint ?? null, code: e2.code ?? null }),
      { status: 500, headers: CORS }
    )
  }

  const holdings = [...(neverRefreshed ?? []), ...(oldest ?? [])]

  if (holdings.length === 0) {
    return new Response(JSON.stringify({ updated: 0, total: 0 }), { headers: CORS })
  }

  const cryptoHoldings = holdings.filter(h => h.asset_type === 'crypto')
  const equityHoldings = holdings.filter(h => h.asset_type !== 'crypto')

  // symbol -> price map
  const priceMap = new Map<string, number>()

  // Parse Twelve Data response — single symbol returns { price: "..." },
  // multiple symbols returns { SYM: { price: "..." }, ... }
  function parsePrices(data: Record<string, unknown>, fallbackSymbol: string, isCrypto: boolean) {
    if (typeof data.price === 'string') {
      const sym = isCrypto ? fallbackSymbol.split('/')[0] : fallbackSymbol
      const price = parseFloat(data.price)
      if (!isNaN(price)) priceMap.set(sym, price)
    } else {
      for (const [key, val] of Object.entries(data)) {
        if (!val || typeof val !== 'object') continue
        const priceStr = (val as Record<string, unknown>).price
        if (typeof priceStr !== 'string') continue
        const price = parseFloat(priceStr)
        if (isNaN(price)) continue
        const sym = isCrypto ? key.split('/')[0] : key
        priceMap.set(sym, price)
      }
    }
  }

  const isDebug = new URL(req.url).searchParams.get('debug') === 'true'
  const debug: Record<string, unknown> = {}

  // Equity batch fetch (stocks, ETFs, mutual funds, bonds)
  if (equityHoldings.length > 0) {
    const uniqueSymbols = [...new Set(equityHoldings.map(h => h.symbol as string))]
    debug.equitySymbols = uniqueSymbols
    try {
      const symbolParam = uniqueSymbols.map(s => encodeURIComponent(s)).join(',')
      const res = await fetch(
        `https://api.twelvedata.com/price?symbol=${symbolParam}&apikey=${TWELVE_DATA_KEY}`
      )
      const data = await res.json() as Record<string, unknown>
      debug.equityResponse = data
      parsePrices(data, uniqueSymbols[0], false)
    } catch (e) {
      debug.equityError = String(e)
    }
  }

  // Crypto batch fetch — Twelve Data uses BTC/USD format
  if (cryptoHoldings.length > 0) {
    const uniqueSymbols = [...new Set(cryptoHoldings.map(h => h.symbol as string))]
    const pairs = uniqueSymbols.map(s => `${s}/USD`)
    debug.cryptoSymbols = uniqueSymbols
    try {
      const symbolParam = pairs.map(s => encodeURIComponent(s)).join(',')
      const res = await fetch(
        `https://api.twelvedata.com/price?symbol=${symbolParam}&apikey=${TWELVE_DATA_KEY}`
      )
      const data = await res.json() as Record<string, unknown>
      debug.cryptoResponse = data
      parsePrices(data, pairs[0], true)
    } catch (e) {
      debug.cryptoError = String(e)
    }
  }

  debug.priceMapEntries = Object.fromEntries(priceMap)

  const now = new Date().toISOString()
  const updateErrors: string[] = []

  // Build upsert rows for all holdings that got a price — one round-trip instead of N
  const upsertRows = holdings
    .filter(h => priceMap.has(h.symbol as string))
    .map(h => ({
      id: h.id,
      current_value: priceMap.get(h.symbol as string)! * h.quantity,
      last_price_updated_at: now,
    }))

  const { error: upsertError } = await supabase
    .from('holdings')
    .upsert(upsertRows, { onConflict: 'id' })

  if (upsertError) updateErrors.push(upsertError.message)
  const updated = upsertError ? 0 : upsertRows.length

  return new Response(
    JSON.stringify({
      updated,
      total: holdings.length,
      timestamp: now,
      ...(isDebug && { debug, updateErrors }),
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
