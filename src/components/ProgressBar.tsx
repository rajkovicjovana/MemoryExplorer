type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <div className="progress-group" aria-label={label}>
      {label ? <span className="progress-label">{label}</span> : null}
      <div className="progress-track">
        <span className="progress-fill" style={{ width }} />
      </div>
    </div>
  );
}
