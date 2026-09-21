export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };
  return (
    <div
      className={`${sizes[size]} rounded-full border-slate-300 border-t-blue-600 animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
