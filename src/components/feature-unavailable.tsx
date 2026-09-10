export function FeatureUnavailable({ title }: { title: string }) {
  return (
    <div className="card panel-block">
      <div className="kicker">Temporarily unavailable</div>
      <h1 className="page-title">{title}</h1>
      <p className="muted">This feature is currently disabled by the platform administrator.</p>
    </div>
  );
}
