import { Link } from 'react-router-dom';

export default function BrandLogo({ to = '/', className = '', compact = false }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 group ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-md group-hover:bg-secondary transition-colors">
        <span className="font-sora text-label-md font-bold leading-none">E</span>
      </span>
      {!compact && (
        <span className="flex flex-col">
          <span className="font-sora text-[1.05rem] font-bold text-primary tracking-tight leading-tight">
            Encre &amp; Cobalt
          </span>
          <span className="font-inter text-[10px] uppercase tracking-[0.18em] text-on-surface-variant leading-none">
            Coworking
          </span>
        </span>
      )}
    </Link>
  );
}
