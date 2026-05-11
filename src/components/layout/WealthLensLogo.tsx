export default function WealthLensLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="7" fill="#0f766e" />
        <path
          d="M6 23 L11 15 L16 18.5 L21 11 L26 11"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="26" cy="11" r="2.5" fill="white" />
      </svg>
      <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
        WealthLens
      </span>
    </div>
  )
}
