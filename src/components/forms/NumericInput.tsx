import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
  currency?: boolean
}

export function NumericInput({ value, onChange, currency = false, className, ...props }: Props) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  function format(n: number): string {
    if (n === 0) return ''
    return currency
      ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(n)
  }

  function handleFocus() {
    setFocused(true)
    setRaw(value === 0 ? '' : String(value))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value
    // Allow digits and one decimal point only
    if (!/^[0-9]*\.?[0-9]*$/.test(input)) return
    setRaw(input)
    const parsed = parseFloat(input)
    onChange(isNaN(parsed) ? 0 : parsed)
  }

  function handleBlur() {
    setFocused(false)
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={focused ? raw : format(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={cn('tabular-nums', className)}
      {...props}
    />
  )
}
