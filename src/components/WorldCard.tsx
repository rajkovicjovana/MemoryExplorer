import type { CSSProperties } from 'react';
import type { World } from '../types/game';
import { useLanguage } from '../i18n/useLanguage';
import { ProgressBar } from './ProgressBar';

type WorldCardProps = {
  world: World;
  selected: boolean;
  onSelect: (world: World) => void;
};

function getWorldAssetId(worldId: string): string {
  if (worldId === 'tropics') {
    return 'tropical';
  }

  if (worldId === 'mountains') {
    return 'mountain';
  }

  return worldId;
}

export function WorldCard({ world, selected, onSelect }: WorldCardProps) {
  const { t } = useLanguage();
  const worldAssetId = getWorldAssetId(world.id);
  const translatedDifficulty = t(`difficulties.${world.difficulty}`);

  return (
    <button
      className={`world-card ${selected ? 'selected' : ''} ${world.unlocked ? '' : 'locked'}`}
      disabled={!world.unlocked}
      onClick={() => onSelect(world)}
      style={{
        '--world-primary': world.theme.primary,
        '--world-secondary': world.theme.secondary,
        '--world-accent': world.theme.accent,
      } as CSSProperties}
      type="button"
    >
      <div className="world-art">
        <div className={`destination-scene scene-${world.id}`} aria-hidden="true">
          <img
            alt=""
            className="asset-world-background"
            decoding="async"
            loading="lazy"
            onLoad={(event) => {
              event.currentTarget.closest('.world-art')?.classList.add('has-world-image');
              event.currentTarget.closest('.destination-scene')?.classList.add('has-world-image');
            }}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            src={`/assets/backgrounds/${worldAssetId}.png`}
          />
          <span className="scene-sun" />
          <span className="scene-cloud cloud-left" />
          <span className="scene-cloud cloud-right" />
          <span className="scene-landform landform-back" />
          <span className="scene-landform landform-front" />
          <span className="scene-route" />
        </div>
        <div className="unlock-indicator">{world.unlocked ? t('common.open') : t('common.locked')}</div>
        {world.sampleCardSymbols.slice(0, 4).map((symbol) => (
          <span key={symbol}>{symbol.slice(0, 2)}</span>
        ))}
      </div>
      <div className="world-copy">
        <div className="world-meta-row">
          <span className="badge destination-badge">{translatedDifficulty}</span>
          <span className="badge">{world.unlocked ? t('worldsScreen.passportReady') : t('worldsScreen.unlockSoon')}</span>
        </div>
        <h2>{t(`worlds.${world.id}.name`)}</h2>
        <p>{t(`worlds.${world.id}.description`)}</p>
        <ProgressBar value={world.progress} label={t('worldsScreen.explored', { progress: world.progress })} />
      </div>
    </button>
  );
}
