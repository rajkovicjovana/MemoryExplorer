import type { ReactNode } from 'react';

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <div className="screen-header">
      <div>
        <span className="eyebrow">Memory Explorer</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action ? <div className="screen-action">{action}</div> : null}
    </div>
  );
}
