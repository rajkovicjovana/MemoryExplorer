import type { PlayerProfile, ScreenId, World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';

type MainMenuProps = {
  availableWorlds: World[];
  onNavigate: (screen: ScreenId) => void;
  profile: PlayerProfile;
};

export function MainMenu({ availableWorlds, onNavigate }: MainMenuProps) {
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
        title="Around the World"
        subtitle="Pick a destination, master every board, and build your explorer legacy."
      />

      <div className="hero-panel">
        <div className="hero-copy">
          <h2>Start Your Journey</h2>
          <p>Explore memory routes across the world.</p>
          <button className="primary-button" onClick={() => onNavigate('world-select')} type="button">
            Start Journey
          </button>
        </div>
      </div>

      <div className="journey-panel">
        <div className="journey-header">
          <span className="eyebrow">Explorer Journey</span>
          <strong>{unlockedWorlds}/{availableWorlds.length}</strong>
        </div>
        <div className="journey-map" aria-label="World unlock path">
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
                <strong>{world.name.replace('Wonders of ', '')}</strong>
                <small>{world.unlocked ? 'Open' : 'Locked'}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
