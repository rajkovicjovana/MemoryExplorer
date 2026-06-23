import { useState } from 'react';
import type { World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorldCard } from '../components/WorldCard';
import { useLanguage } from '../i18n/useLanguage';

type WorldSelectProps = {
  availableWorlds: World[];
  selectedWorld: World;
  onSelectWorld: (world: World) => void;
  onContinue: () => void;
};

export function WorldSelect({ availableWorlds, selectedWorld, onSelectWorld, onContinue }: WorldSelectProps) {
  const { t } = useLanguage();
  const [previewWorld, setPreviewWorld] = useState<World | null>(null);

  const getWorldAssetId = (worldId: string) => {
    if (worldId === 'tropics') {
      return 'tropical';
    }

    if (worldId === 'mountains') {
      return 'mountain';
    }

    return worldId;
  };

  const getGridSize = (world: World) => {
    if (world.difficulty === 'Easy') {
      return '4x4';
    }

    if (world.difficulty === 'Medium') {
      return '4x5';
    }

    return '6x6';
  };

  return (
    <section className="screen">
      <ScreenHeader
        title={t('worldsScreen.title')}
        subtitle={t('worldsScreen.subtitle')}
        action={<button className="small-button" onClick={onContinue} type="button">{t('common.modes')}</button>}
      />
      <div className="world-list">
        {availableWorlds.map((world) => (
          <WorldCard
            key={world.id}
            onSelect={setPreviewWorld}
            selected={selectedWorld.id === world.id}
            world={world}
          />
        ))}
      </div>
      {previewWorld ? (
        <div className="victory-overlay world-preview-overlay" role="dialog" aria-modal="true" aria-label={t('preview.worldPreview')}>
          <div className="victory-card world-preview-card">
            <div className="world-preview-banner">
              <img
                alt=""
                decoding="async"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
                src={`/assets/backgrounds/${getWorldAssetId(previewWorld.id)}.png`}
              />
            </div>
            <span className="badge destination-badge">{getGridSize(previewWorld)}</span>
            <h2>{t(`worlds.${previewWorld.id}.name`)}</h2>
            <p>{t(`worlds.${previewWorld.id}.description`)}</p>
            <p className="world-preview-theme">{t(`preview.themes.${previewWorld.id}`)}</p>
            <div className="world-preview-meta">
              <span><strong>{getGridSize(previewWorld)}</strong>{t('preview.gridSize')}</span>
              <span><strong>{previewWorld.sampleCardSymbols.length}</strong>{t('preview.collectibleCards', { count: previewWorld.sampleCardSymbols.length })}</span>
            </div>
            <div className="game-action-row">
              <button className="secondary-button" onClick={() => setPreviewWorld(null)} type="button">
                {t('preview.back')}
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  onSelectWorld(previewWorld);
                  setPreviewWorld(null);
                  onContinue();
                }}
                type="button"
              >
                {t('preview.continue')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
