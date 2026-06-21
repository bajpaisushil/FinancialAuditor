export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AuditKosh"
    >
      <rect x="11" y="9" width="42" height="46" rx="9" fill="#243465" />
      <line x1="20" y1="22" x2="44" y2="22" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="31" x2="44" y2="31" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="40" x2="34" y2="40" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="45" cy="44" r="13" fill="#e8b24a" />
      <path d="M39.5 44.5 L43.5 48.5 L51 40.5" stroke="#243465" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
