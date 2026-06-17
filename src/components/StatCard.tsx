type StatCardProps = {
  label: string;
  value: string | number;
  tone?: 'blue' | 'green' | 'gold' | 'pink';
};

export function StatCard({ label, value, tone = 'blue' }: StatCardProps) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
