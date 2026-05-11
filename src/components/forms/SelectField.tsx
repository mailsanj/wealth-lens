import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export function SelectField({ value, onChange, options, placeholder = 'Select…', className }: Props) {
  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <Select value={value} onValueChange={(v: string | null) => onChange(v ?? '')}>
      <SelectTrigger className={cn('w-full', className)}>
        <span className={selectedLabel ? undefined : 'text-muted-foreground'}>
          {selectedLabel ?? placeholder}
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
