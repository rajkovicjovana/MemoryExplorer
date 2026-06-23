import { Bot, Layers, Leaf, Mountain, Timer, Users } from 'lucide-react';
import type { GameMode, World } from '../types/game';
import { gameModes } from '../data/gameData';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../i18n/useLanguage';

type ModeSelectProps = {
  duelPlayers: { player1: string; player2: string };
  selectedMode: GameMode;
  selectedWorld: World;
  onSetDuelPlayers: (players: { player1: string; player2: string }) => void;
  onSelectMode: (mode: GameMode) => void;
  onPlay: (mode?: GameMode) => void;
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
  const { t } = useLanguage();

  return (
    <section className="screen">
      <ScreenHeader
        title={t('modesScreen.title')}
        subtitle={t('modesScreen.subtitle', { world: t(`worlds.${selectedWorld.id}.name`) })}
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
          const presentationKey = `modesScreen.presentation.${mode.id}`;

          return (
            <button
              className={mode.id === selectedMode.id ? 'mode-card selected' : 'mode-card'}
              key={mode.id}
              onClick={() => {
                onSelectMode(mode);

                if (mode.id !== 'duel') {
                  onPlay(mode);
                }
              }}
              type="button"
            >
              <span className="mode-icon" aria-hidden="true">
                <ModeIcon size={34} strokeWidth={2.5} />
              </span>
              <span className="badge">{t(`${presentationKey}.difficulty`) || presentation.difficulty}</span>
              <h2>{t(`modes.${mode.id}.name`) || mode.name}</h2>
              <p>{t(`${presentationKey}.tagline`) || presentation.tagline}</p>
              <small>{t(`${presentationKey}.instructions`) || presentation.instructions}</small>
            </button>
          );
        })}
      </div>
      {selectedMode.id === 'duel' ? (
        <div className="duel-name-panel">
          <div>
            <label htmlFor="player-one-name">{t('modesScreen.playerOneName')}</label>
            <input
              id="player-one-name"
              maxLength={18}
              onChange={(event) => onSetDuelPlayers({ ...duelPlayers, player1: event.target.value })}
              placeholder={t('modesScreen.playerOne')}
              type="text"
              value={duelPlayers.player1}
            />
          </div>
          <div>
            <label htmlFor="player-two-name">{t('modesScreen.playerTwoName')}</label>
            <input
              id="player-two-name"
              maxLength={18}
              onChange={(event) => onSetDuelPlayers({ ...duelPlayers, player2: event.target.value })}
              placeholder={t('modesScreen.playerTwo')}
              type="text"
              value={duelPlayers.player2}
            />
          </div>
        </div>
      ) : null}
      {selectedMode.id === 'duel' ? (
        <button className="primary-button wide" onClick={() => onPlay(selectedMode)} type="button">
          {t('modesScreen.startGame')}
        </button>
      ) : null}
    </section>
  );
}
