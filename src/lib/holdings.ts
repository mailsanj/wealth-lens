/**
 * Computes the effective value of a holding for net worth purposes.
 *
 * For real estate: deducts mortgage_balance and heloc_balance from current_value
 * to return true equity (can be negative for underwater mortgages).
 * All other asset types: returns current_value unchanged.
 */
export function computeEffectiveValue(holding: {
  asset_type: string
  current_value: number
  metadata: Record<string, unknown>
}): number {
  if (holding.asset_type === 'real_estate') {
    const mortgage = Number(holding.metadata?.mortgage_balance ?? 0)
    const heloc = Number(holding.metadata?.heloc_balance ?? 0)
    return holding.current_value - mortgage - heloc
  }
  return holding.current_value
}
