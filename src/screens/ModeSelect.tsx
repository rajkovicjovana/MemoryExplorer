import type { GameMode, World } from '../types/game';
import { gameModes } from '../data/gameData';
import { ScreenHeader } from '../components/ScreenHeader';

type ModeSelectProps = {
  duelPlayers: { player1: string; player2: string };
  selectedMode: GameMode;
  selectedWorld: World;
  onSetDuelPlayers: (players: { player1: string; player2: string }) => void;
  onSelectMode: (mode: GameMode) => void;
  onPlay: () => void;
};

export function ModeSelect({ duelPlayers, selectedMode, selectedWorld, onSetDuelPlayers, onSelectMode, onPlay }: ModeSelectProps) {
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
      {selectedMode.id === 'duel' ? (
        <div className="duel-name-panel">
          <div>
            <label htmlFor="player-one-name">Player 1 name</label>
            <input
              id="player-one-name"
              maxLength={18}
              onChange={(event) => onSetDuelPlayers({ ...duelPlayers, player1: event.target.value })}
              placeholder="Player 1"
              type="text"
              value={duelPlayers.player1}
            />
          </div>
          <div>
            <label htmlFor="player-two-name">Player 2 name</label>
            <input
              id="player-two-name"
              maxLength={18}
              onChange={(event) => onSetDuelPlayers({ ...duelPlayers, player2: event.target.value })}
              placeholder="Player 2"
              type="text"
              value={duelPlayers.player2}
            />
          </div>
        </div>
      ) : null}
      <button className="primary-button wide" onClick={onPlay} type="button">
        Start Game
      </button>
    </section>
  );
}
