import { useState, useEffect } from 'react'
import { fetchRates } from '@/lib/currency'

interface State {
  rates: Record<string, number>
  loading: boolean
  error: string | null
}

/**
 * Fetches and caches exchange rates for a given base currency.
 * Rates are keyed as { TARGET_CURRENCY: multiplier_from_base }.
 * The base currency itself is always included as { [base]: 1 }.
 */
export function useExchangeRates(baseCurrency: string): State {
  const [state, setState] = useState<State>({ rates: { [baseCurrency]: 1 }, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: null }))
    fetchRates(baseCurrency)
      .then(rates => { if (!cancelled) setState({ rates, loading: false, error: null }) })
      .catch(err => { if (!cancelled) setState({ rates: { [baseCurrency]: 1 }, loading: false, error: String(err) }) })
    return () => { cancelled = true }
  }, [baseCurrency])

  return state
}
