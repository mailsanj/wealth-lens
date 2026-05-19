import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const TWELVE_DATA_KEY       = Deno.env.get('TWELVE_DATA_API_KEY') ?? ''
const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY') ?? ''
const TWILIO_ACCOUNT_SID    = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_FROM_NUMBER    = Deno.env.get('TWILIO_FROM_NUMBER') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface AlertRule {
  id: string
  user_id: string
  alert_type: 'holding_stock' | 'holding_portfolio'
  symbol: string | null
  portfolio_id: string | null
  direction: 'up' | 'down' | 'either'
  amount_type: 'dollars' | 'percent'
  amount: number
  notify_email: boolean
  notify_sms: boolean
  email: string | null
  phone: string | null
  cooldown_value: number
  cooldown_unit: 'minutes' | 'hours' | 'days'
  last_triggered_at: string | null
  label: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'Missing Supabase config' }), { status: 500, headers: CORS })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch all active alert rules
  const { data: rules, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)

  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), { status: 500, headers: CORS })
  }
  if (!rules || rules.length === 0) {
    return new Response(JSON.stringify({ checked: 0, triggered: 0 }), { headers: CORS })
  }

  const now = new Date()
  let triggered = 0

  // ── Fetch current stock prices (batch, up to 8 unique symbols) ────────────
  const stockRules = (rules as AlertRule[]).filter(r => r.alert_type === 'holding_stock' && r.symbol)
  const uniqueSymbols = [...new Set(stockRules.map(r => r.symbol as string))].slice(0, 8)
  const currentPrices = new Map<string, number>()

  if (uniqueSymbols.length > 0 && TWELVE_DATA_KEY) {
    try {
      const symbolParam = uniqueSymbols.map(s => encodeURIComponent(s)).join(',')
      const res = await fetch(`https://api.twelvedata.com/price?symbol=${symbolParam}&apikey=${TWELVE_DATA_KEY}`)
      const data = await res.json() as Record<string, unknown>

      if (typeof data.price === 'string') {
        currentPrices.set(uniqueSymbols[0], parseFloat(data.price))
      } else {
        for (const [sym, val] of Object.entries(data)) {
          if (val && typeof (val as Record<string, unknown>).price === 'string') {
            currentPrices.set(sym, parseFloat((val as Record<string, unknown>).price as string))
          }
        }
      }
    } catch (_e) { /* continue with whatever prices we have */ }
  }

  // ── Fetch previous-close prices from stock_price_history ─────────────────
  const previousPrices = new Map<string, number>()
  if (uniqueSymbols.length > 0) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    // Look back up to 5 days to handle weekends/holidays
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 5)

    const { data: history } = await supabase
      .from('stock_price_history')
      .select('symbol, price, date')
      .in('symbol', uniqueSymbols)
      .gte('date', cutoff.toISOString().split('T')[0])
      .lt('date', now.toISOString().split('T')[0])
      .order('date', { ascending: false })

    // Take the most recent entry per symbol
    for (const row of (history ?? []) as { symbol: string; price: number; date: string }[]) {
      if (!previousPrices.has(row.symbol)) previousPrices.set(row.symbol, row.price)
    }
  }

  // ── Evaluate each rule ────────────────────────────────────────────────────
  for (const rule of rules as AlertRule[]) {
    // Check cooldown
    if (rule.last_triggered_at) {
      const cooldownMs = rule.cooldown_value * (
        rule.cooldown_unit === 'minutes' ? 60_000 :
        rule.cooldown_unit === 'hours'   ? 3_600_000 : 86_400_000
      )
      if (now.getTime() - new Date(rule.last_triggered_at).getTime() < cooldownMs) continue
    }

    let shouldTrigger = false
    let changeAmt = 0
    let changePct = 0
    let currentValue = 0
    let previousValue = 0
    let targetLabel = ''

    if (rule.alert_type === 'holding_stock' && rule.symbol) {
      const current = currentPrices.get(rule.symbol)
      const previous = previousPrices.get(rule.symbol)
      if (!current || !previous) continue

      currentValue = current
      previousValue = previous
      changeAmt = current - previous
      changePct = (changeAmt / previous) * 100
      targetLabel = rule.symbol
    } else if (rule.alert_type === 'holding_portfolio' && rule.portfolio_id) {
      // Current portfolio value: sum holdings.current_value
      const { data: holdings } = await supabase
        .from('holdings')
        .select('current_value')
        .eq('portfolio_id', rule.portfolio_id)

      currentValue = (holdings ?? []).reduce((s: number, h: { current_value: number }) => s + (h.current_value ?? 0), 0)

      // Previous value: most recent portfolio snapshot before today
      const cutoff = new Date(now)
      cutoff.setDate(cutoff.getDate() - 5)
      const { data: snapshots } = await supabase
        .from('portfolio_snapshots')
        .select('total_value')
        .eq('portfolio_id', rule.portfolio_id)
        .lt('snapshot_date', now.toISOString().split('T')[0])
        .gte('snapshot_date', cutoff.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false })
        .limit(1)

      if (!snapshots || snapshots.length === 0) continue
      previousValue = (snapshots[0] as { total_value: number }).total_value
      changeAmt = currentValue - previousValue
      changePct = previousValue > 0 ? (changeAmt / previousValue) * 100 : 0

      // Get portfolio name for the message
      const { data: portfolio } = await supabase
        .from('portfolios').select('name').eq('id', rule.portfolio_id).single()
      targetLabel = (portfolio as { name: string } | null)?.name ?? 'Portfolio'
    } else {
      continue
    }

    // Evaluate direction + threshold
    const absAmt = Math.abs(changeAmt)
    const absPct = Math.abs(changePct)
    const movedUp   = changeAmt > 0
    const movedDown = changeAmt < 0
    const dirOk = rule.direction === 'either' ||
      (rule.direction === 'up'   && movedUp) ||
      (rule.direction === 'down' && movedDown)

    const thresholdMet = rule.amount_type === 'dollars'
      ? absAmt >= rule.amount
      : absPct >= rule.amount

    shouldTrigger = dirOk && thresholdMet

    if (!shouldTrigger) continue

    // Build notification message
    const direction  = movedUp ? 'up' : 'down'
    const changeStr  = rule.amount_type === 'dollars'
      ? `$${absAmt.toFixed(2)}`
      : `${absPct.toFixed(2)}%`
    const subject    = `WealthLens Alert: ${targetLabel} moved ${direction} ${changeStr}`
    const body       = `${rule.label ? `[${rule.label}] ` : ''}${targetLabel} has moved ${direction} by ${changeStr} (from ${previousValue.toFixed(2)} to ${currentValue.toFixed(2)}).`

    // Send email
    if (rule.notify_email && rule.email && RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'WealthLens <onboarding@resend.dev>',
            to: rule.email,
            subject,
            html: `<p>${body}</p><p style="color:#666;font-size:12px;">WealthLens · Manage alerts in Settings</p>`,
          }),
        })
      } catch (_e) { /* log silently — don't block SMS send */ }
    }

    // Send SMS via Twilio
    if (rule.notify_sms && rule.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
      try {
        const formData = new URLSearchParams({
          To: rule.phone,
          From: TWILIO_FROM_NUMBER,
          Body: `WealthLens: ${body}`,
        })
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
          }
        )
      } catch (_e) { /* continue */ }
    }

    // Update last_triggered_at
    await supabase
      .from('alert_rules')
      .update({ last_triggered_at: now.toISOString() })
      .eq('id', rule.id)

    triggered++
  }

  return new Response(
    JSON.stringify({ checked: rules.length, triggered }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
