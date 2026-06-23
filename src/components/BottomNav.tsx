import type { ScreenId } from '../types/game';
import { useLanguage } from '../i18n/useLanguage';

type NavItem = {
  id: ScreenId;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { id: 'main-menu', label: 'Home', icon: 'H' },
  { id: 'world-select', label: 'Worlds', icon: 'W' },
  { id: 'daily', label: 'Daily', icon: 'D' },
  { id: 'profile', label: 'Profile', icon: 'P' },
  { id: 'shop', label: 'Shop', icon: 'S' },
];

type BottomNavProps = {
  activeScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
};

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const { t } = useLanguage();

  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      {navItems.map((item) => (
        <button
          className={item.id === activeScreen ? 'nav-item active' : 'nav-item'}
          key={item.id}
          onClick={() => onNavigate(item.id)}
          type="button"
        >
          <span aria-hidden="true">{item.icon}</span>
          {t(`nav.${item.id === 'main-menu' ? 'home' : item.id === 'world-select' ? 'worlds' : item.id}`) || item.label}
        </button>
      ))}
    </nav>
  );
}
