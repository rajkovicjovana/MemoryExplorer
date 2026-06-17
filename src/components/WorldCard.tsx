import type { CSSProperties } from 'react';
import type { World } from '../types/game';
import { ProgressBar } from './ProgressBar';

type WorldCardProps = {
  world: World;
  selected: boolean;
  onSelect: (world: World) => void;
};

export function WorldCard({ world, selected, onSelect }: WorldCardProps) {
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
          <span className="scene-sun" />
          <span className="scene-cloud cloud-left" />
          <span className="scene-cloud cloud-right" />
          <span className="scene-landform landform-back" />
          <span className="scene-landform landform-front" />
          <span className="scene-route" />
        </div>
        <div className="unlock-indicator">{world.unlocked ? 'Open' : 'Locked'}</div>
        {world.sampleCardSymbols.slice(0, 4).map((symbol) => (
          <span key={symbol}>{symbol.slice(0, 2)}</span>
        ))}
      </div>
      <div className="world-copy">
        <div className="world-meta-row">
          <span className="badge destination-badge">{world.difficulty}</span>
          <span className="badge">{world.unlocked ? 'Passport Ready' : 'Unlock Soon'}</span>
        </div>
        <h2>{world.name}</h2>
        <p>{world.description}</p>
        <ProgressBar value={world.progress} label={`${world.progress}% explored`} />
      </div>
    </button>
  );
}
