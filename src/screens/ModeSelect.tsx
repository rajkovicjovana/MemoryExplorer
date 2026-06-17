import type { GameMode, World } from '../types/game';
import { gameModes } from '../data/gameData';
import { ScreenHeader } from '../components/ScreenHeader';

type ModeSelectProps = {
  selectedMode: GameMode;
  selectedWorld: World;
  onSelectMode: (mode: GameMode) => void;
  onPlay: () => void;
};

export function ModeSelect({ selectedMode, selectedWorld, onSelectMode, onPlay }: ModeSelectProps) {
  return (
    <section className="screen">
      <ScreenHeader
        title="Select Mode"
        subtitle={`Choose how you want to explore ${selectedWorld.name}.`}
      />
      <div className="mode-grid">
        {gameModes.map((mode) => (
          <button
            className={mode.id === selectedMode.id ? 'mode-card selected' : 'mode-card'}
            key={mode.id}
            onClick={() => onSelectMode(mode)}
            type="button"
          >
            <span className="badge">{mode.recommendedFor}</span>
            <h2>{mode.name}</h2>
            <p>{mode.description}</p>
            <strong>{mode.reward}</strong>
          </button>
        ))}
      </div>
      <button className="primary-button wide" onClick={onPlay} type="button">
        Start Game
      </button>
    </section>
  );
}
