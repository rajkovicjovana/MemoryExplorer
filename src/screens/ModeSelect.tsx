import { Bot, Layers, Leaf, Mountain, Timer, Users } from 'lucide-react';
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

const modePresentation: Record<string, { difficulty: string; Icon: typeof Layers; instructions: string; tagline: string }> = {
  classic: { difficulty: 'Easy', Icon: Layers, tagline: 'Pure memory route', instructions: 'Match all pairs at your own pace.' },
  'time-attack': { difficulty: 'Fast', Icon: Timer, tagline: 'Beat the clock', instructions: 'Finish before time runs out.' },
  survival: { difficulty: 'Hard', Icon: Mountain, tagline: 'Limited moves', instructions: 'Complete the board before moves run out.' },
  zen: { difficulty: 'Calm', Icon: Leaf, tagline: 'Calm exploration', instructions: 'No pressure, no penalties.' },
  ai: { difficulty: 'Rival', Icon: Bot, tagline: 'Outsmart the AI', instructions: 'Take turns against memory AI.' },
  duel: { difficulty: 'Local', Icon: Users, tagline: 'Local duel', instructions: 'Two players take turns on one device.' },
};

export function ModeSelect({ duelPlayers, selectedMode, selectedWorld, onSetDuelPlayers, onSelectMode, onPlay }: ModeSelectProps) {
  return (
    <section className="screen">
      <ScreenHeader
        title="Select Mode"
        subtitle={`Choose how you want to explore ${selectedWorld.name}.`}
      />
      <div className="mode-grid">
        {gameModes.map((mode) => {
          const presentation = modePresentation[mode.id] ?? {
            difficulty: mode.recommendedFor,
            Icon: Layers,
            instructions: mode.description,
            tagline: mode.name,
          };
          const ModeIcon = presentation.Icon;

          return (
            <button
              className={mode.id === selectedMode.id ? 'mode-card selected' : 'mode-card'}
              key={mode.id}
              onClick={() => onSelectMode(mode)}
              type="button"
            >
              <span className="mode-icon" aria-hidden="true">
                <ModeIcon size={34} strokeWidth={2.5} />
              </span>
              <span className="badge">{presentation.difficulty}</span>
              <h2>{mode.name}</h2>
              <p>{presentation.tagline}</p>
              <small>{presentation.instructions}</small>
            </button>
          );
        })}
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
