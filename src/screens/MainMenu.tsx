import type { PlayerProfile, ScreenId, World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../i18n/useLanguage';

type MainMenuProps = {
  availableWorlds: World[];
  onNavigate: (screen: ScreenId) => void;
  profile: PlayerProfile;
};

export function MainMenu({ availableWorlds, onNavigate }: MainMenuProps) {
  const { t } = useLanguage();
  const unlockedWorlds = availableWorlds.filter((world) => world.unlocked).length;
  const currentWorldIndex = Math.max(0, unlockedWorlds - 1);

  const getWorldAssetId = (worldId: string) => {
    if (worldId === 'tropics') {
      return 'tropical';
    }

    if (worldId === 'mountains') {
      return 'mountain';
    }

    return worldId;
  };

  return (
    <section className="screen main-menu">
      <ScreenHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
      />

      <div className="hero-panel">
        <div className="hero-copy">
          <h2>{t('home.heroTitle')}</h2>
          <p>{t('home.heroText')}</p>
          <button className="primary-button" onClick={() => onNavigate('world-select')} type="button">
            {t('home.startJourney')}
          </button>
        </div>
      </div>

      <div className="journey-panel">
        <div className="journey-header">
          <span className="eyebrow">{t('home.journey')}</span>
          <strong>{unlockedWorlds}/{availableWorlds.length}</strong>
        </div>
        <div className="journey-map" aria-label={t('home.worldUnlockPath')}>
          {availableWorlds.map((world, index) => (
            <div
              className={`journey-node ${world.unlocked ? 'unlocked' : 'locked'} ${index === currentWorldIndex ? 'current' : ''}`}
              key={world.id}
            >
              <span className="journey-pin" aria-hidden="true">
                <img
                  alt=""
                  decoding="async"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                  src={`/assets/backgrounds/${getWorldAssetId(world.id)}.png`}
                />
              </span>
              <div>
                <strong>{t(`worlds.${world.id}.shortName`)}</strong>
                <small>{world.unlocked ? t('common.open') : t('common.locked')}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
