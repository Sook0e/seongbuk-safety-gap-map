export default function AdminMetrics({ items, className = '' }) {
  return <dl className={`admin-metrics ${className}`}>
    {items.map(([label, value, detail]) => (
      <div key={label} className="admin-panel">
        <dt className="text-sm text-sub">{label}</dt>
        <dd className="my-1 text-2xl font-bold">{value ?? '—'}</dd>
        <dd className="text-xs text-sub">{detail}</dd>
      </div>
    ))}
  </dl>
}
