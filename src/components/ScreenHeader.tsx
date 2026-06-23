import type { ReactNode } from 'react';
import { useLanguage } from '../i18n/useLanguage';

type ScreenHeaderProps = {
  title: string;
  subtitle: string;
  action?: ReactNode;
};

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="screen-header">
      <div>
        <span className="eyebrow">{t('app.eyebrow')}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action ? <div className="screen-action">{action}</div> : null}
    </div>
  );
}
