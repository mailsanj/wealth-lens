// Currency conversion using the ExchangeRate-API (https://open.er-api.com)
// Free tier — no API key required, ~170 currencies, updated every 24h.
// Rates are cached in localStorage for 4 hours to avoid redundant fetches.
// Falls back to Frankfurter (https://api.frankfurter.app) if primary fails.

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours
const TIMEOUT_MS = 8000                   // 8 second timeout per attempt
const LS_KEY_PREFIX = 'wealthlens:fx:'

interface CacheEntry {
  rates: Record<string, number>
  fetchedAt: number
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

/** Fetch exchange rates for a given base currency. Returns rates as { TARGET: multiplier }. */
export async function fetchRates(base: string): Promise<Record<string, number>> {
  const cacheKey = `${LS_KEY_PREFIX}${base}`

  // Return cached rates if still fresh
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const { rates, fetchedAt } = JSON.parse(cached) as CacheEntry
      if (Date.now() - fetchedAt < CACHE_TTL_MS) return { ...rates, [base]: 1 }
    }
  } catch { /* ignore corrupted cache */ }

  let rates: Record<string, number> | null = null

  // Primary: open.er-api.com (free, no key, ~170 currencies)
  try {
    const res = await fetchWithTimeout(`https://open.er-api.com/v6/latest/${base}`)
    if (res.ok) {
      const data = await res.json() as { result: string; rates: Record<string, number> }
      if (data.result === 'success') rates = data.rates
    }
  } catch { /* fall through to backup */ }

  // Fallback: Frankfurter
  if (!rates) {
    const res = await fetchWithTimeout(`https://api.frankfurter.app/latest?base=${base}`)
    if (!res.ok) throw new Error(`FX rates unavailable (HTTP ${res.status})`)
    const data = await res.json() as { rates: Record<string, number> }
    rates = { ...data.rates, [base]: 1 }
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ rates, fetchedAt: Date.now() }))
  } catch { /* ignore if localStorage is full */ }

  return { ...rates, [base]: 1 }
}

/**
 * Convert an amount from one currency to another.
 * All rates must be relative to the same base (as returned by fetchRates).
 * Returns the original amount unchanged if either currency is missing from rates.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
): number {
  if (from === to) return amount
  const fromRate = rates[from]  // base → from
  const toRate = rates[to]      // base → to
  if (!fromRate || !toRate) return amount
  // Convert: amount (from) → base → to
  return (amount / fromRate) * toRate
}

/** Format a rate label e.g. "1 USD = 0.9195 EUR" */
export function rateLabel(from: string, to: string, rates: Record<string, number>): string {
  if (from === to || !rates[to]) return ''
  return `1 ${from} = ${convert(1, from, to, rates).toFixed(4)} ${to}`
}
