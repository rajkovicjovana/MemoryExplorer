import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Achievement, GameMode, ScreenId, World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import type { AchievementProgress, ProgressUpdate, VictoryProgress } from '../utils/progression';
import { formatDuration } from '../utils/progression';

type MemoryCard = {
  id: string;
  pairId: string;
  symbol: string;
  label: string;
  matched: boolean;
};

type BoardConfig = {
  columns: number;
  rows: number;
  timeLimit: number;
  survivalMaxMoves: number;
};

type GameStatus = 'playing' | 'won' | 'lost';

type PowerUpId = 'compass' | 'camera' | 'fast-travel' | 'golden-passport' | 'shuffle' | 'souvenir';

type PowerUp = {
  id: PowerUpId;
  icon: string;
  name: string;
  description: string;
};

type GameplayPlaceholderProps = {
  mode: GameMode;
  world: World;
  onAchievementUnlock: (achievementIds: string[]) => AchievementProgress;
  onLoss: () => void;
  onNavigate: (screen: ScreenId) => void;
  onVictory: (victory: VictoryProgress) => ProgressUpdate;
};

type VictoryRewards = {
  earnedCoins: number;
  earnedXp: number;
  leveledUp: boolean;
};

const mismatchDelayMs = 760;
const souvenirScoreBonus = 250;
const souvenirCoinBonus = 120;

const powerUps: PowerUp[] = [
  { id: 'compass', icon: 'CP', name: 'Compass', description: 'Peek one unmatched pair for 2s.' },
  { id: 'camera', icon: 'CA', name: 'Camera', description: 'Peek all unmatched cards for 3s.' },
  { id: 'fast-travel', icon: 'FT', name: 'Fast Travel', description: '+15s in Time Attack, score otherwise.' },
  { id: 'golden-passport', icon: 'GP', name: 'Golden Passport', description: 'Next card auto-finds its pair.' },
  { id: 'shuffle', icon: 'SH', name: 'Shuffle', description: 'Shuffle hidden unmatched cards.' },
  { id: 'souvenir', icon: 'SB', name: 'Souvenir Bonus', description: 'Bonus score and coins after victory.' },
];

function getBoardConfig(world: World): BoardConfig {
  if (world.difficulty === 'Easy') {
    return { columns: 4, rows: 4, timeLimit: 90, survivalMaxMoves: 35 };
  }

  if (world.difficulty === 'Medium') {
    return { columns: 4, rows: 5, timeLimit: 120, survivalMaxMoves: 50 };
  }

  return { columns: 6, rows: 6, timeLimit: 180, survivalMaxMoves: 80 };
}

function shuffleCards(cards: MemoryCard[]): MemoryCard[] {
  const nextCards = [...cards];

  for (let index = nextCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextCards[index], nextCards[swapIndex]] = [nextCards[swapIndex], nextCards[index]];
  }

  return nextCards;
}

function buildDeck(world: World, config: BoardConfig): MemoryCard[] {
  const pairCount = (config.columns * config.rows) / 2;
  const pairs = Array.from({ length: pairCount }, (_, index) => {
    const symbol = world.sampleCardSymbols[index % world.sampleCardSymbols.length];
    const routeNumber = Math.floor(index / world.sampleCardSymbols.length) + 1;
    const label = routeNumber > 1 ? `${symbol.slice(0, 2)}${routeNumber}` : symbol.slice(0, 2);

    return {
      pairId: `${world.id}-${symbol}-${routeNumber}`,
      symbol,
      label,
    };
  });

  return shuffleCards(
    pairs.flatMap((pair, index) => [
      { id: `${pair.pairId}-a-${index}`, pairId: pair.pairId, symbol: pair.symbol, label: pair.label, matched: false },
      { id: `${pair.pairId}-b-${index}`, pairId: pair.pairId, symbol: pair.symbol, label: pair.label, matched: false },
    ]),
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');

  return `${minutes}:${remainingSeconds}`;
}

function getModeLabel(mode: GameMode): string {
  if (mode.id === 'challenge') {
    return 'Challenge Route';
  }

  if (mode.id === 'ai') {
    return 'AI Duel Preview';
  }

  return mode.name;
}

function getGameplaySubtitle(mode: GameMode, world: World, boardConfig: BoardConfig): string {
  const routeLabel = `${world.name} - ${boardConfig.columns}x${boardConfig.rows} memory route`;

  if (mode.id === 'survival') {
    return `${routeLabel}. Complete the board before you run out of moves.`;
  }

  return routeLabel;
}

function calculateRewards(score: number, bestCombo: number, hasSouvenirBonus: boolean): Omit<VictoryRewards, 'leveledUp'> {
  return {
    earnedXp: Math.max(40, Math.round(score / 8) + bestCombo * 12),
    earnedCoins: Math.max(20, Math.round(score / 18) + bestCombo * 4) + (hasSouvenirBonus ? souvenirCoinBonus : 0),
  };
}

export function GameplayPlaceholder({ mode, world, onAchievementUnlock, onLoss, onNavigate, onVictory }: GameplayPlaceholderProps) {
  const [restartKey, setRestartKey] = useState(0);

  return (
    <GameplaySession
      key={`${world.id}-${mode.id}-${restartKey}`}
      mode={mode}
      onAchievementUnlock={onAchievementUnlock}
      onLoss={onLoss}
      onNavigate={onNavigate}
      onRestart={() => setRestartKey((currentKey) => currentKey + 1)}
      onVictory={onVictory}
      world={world}
    />
  );
}

type GameplaySessionProps = GameplayPlaceholderProps & {
  onRestart: () => void;
};

function GameplaySession({ mode, world, onAchievementUnlock, onLoss, onNavigate, onRestart, onVictory }: GameplaySessionProps) {
  const boardConfig = useMemo(() => getBoardConfig(world), [world]);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(world, boardConfig));
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(boardConfig.timeLimit);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [victoryRewards, setVictoryRewards] = useState<VictoryRewards | null>(null);
  const [newlyUnlockedAchievements, setNewlyUnlockedAchievements] = useState<Achievement[]>([]);
  const [usedPowerUps, setUsedPowerUps] = useState<PowerUpId[]>([]);
  const [temporaryRevealedIds, setTemporaryRevealedIds] = useState<string[]>([]);
  const [goldenPassportActive, setGoldenPassportActive] = useState(false);
  const [powerUpMessage, setPowerUpMessage] = useState('');
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);

  const pairCount = cards.length / 2;
  const isTimeAttack = mode.id === 'time-attack';
  const isSurvival = mode.id === 'survival';
  const isZen = mode.id === 'zen';
  const remainingMoves = Math.max(0, boardConfig.survivalMaxMoves - moves);
  const hasSouvenirBonus = usedPowerUps.includes('souvenir');
  const displayedRewards = victoryRewards ?? { ...calculateRewards(score, bestCombo, hasSouvenirBonus), leveledUp: false };
  const powerUpsEnabled = !isZen;

  const showAchievementUnlocks = (nextAchievements: Achievement[]) => {
    if (nextAchievements.length === 0) {
      return;
    }

    setNewlyUnlockedAchievements((currentAchievements) => {
      const currentIds = new Set(currentAchievements.map((achievement) => achievement.id));
      const uniqueNextAchievements = nextAchievements.filter((achievement) => !currentIds.has(achievement.id));

      return [...currentAchievements, ...uniqueNextAchievements];
    });
  };

  const showPowerUpMessage = (message: string) => {
    setPowerUpMessage(message);
    window.setTimeout(() => setPowerUpMessage(''), 2200);
  };

  const markPowerUpUsed = (powerUpId: PowerUpId) => {
    setUsedPowerUps((currentPowerUps) => (currentPowerUps.includes(powerUpId) ? currentPowerUps : [...currentPowerUps, powerUpId]));
  };

  const revealTemporarily = (cardIds: string[], durationMs: number) => {
    setTemporaryRevealedIds(cardIds);
    setIsResolving(true);
    window.setTimeout(() => {
      setTemporaryRevealedIds([]);
      setIsResolving(false);
    }, durationMs);
  };

  const findUnmatchedPair = (nextCards: MemoryCard[]) => {
    const unmatchedCards = nextCards.filter((card) => !card.matched);

    return unmatchedCards.find((card) => unmatchedCards.some((item) => item.id !== card.id && item.pairId === card.pairId));
  };

  const handlePowerUp = (powerUp: PowerUp) => {
    if (
      !powerUpsEnabled ||
      status !== 'playing' ||
      isResolving ||
      goldenPassportActive ||
      flippedIds.length > 0 ||
      usedPowerUps.includes(powerUp.id)
    ) {
      return;
    }

    if (powerUp.id === 'compass') {
      const pairCard = findUnmatchedPair(cards);

      if (!pairCard) {
        return;
      }

      const pairIds = cards.filter((card) => !card.matched && card.pairId === pairCard.pairId).map((card) => card.id);
      markPowerUpUsed(powerUp.id);
      revealTemporarily(pairIds, 2000);
      showPowerUpMessage('Compass revealed one route pair.');
      return;
    }

    if (powerUp.id === 'camera') {
      markPowerUpUsed(powerUp.id);
      revealTemporarily(cards.filter((card) => !card.matched).map((card) => card.id), 3000);
      showPowerUpMessage('Camera previewed the whole board.');
      return;
    }

    if (powerUp.id === 'fast-travel') {
      markPowerUpUsed(powerUp.id);

      if (isTimeAttack) {
        setTimeLeft((currentTime) => currentTime + 15);
        showPowerUpMessage('Fast Travel added 15 seconds.');
      } else {
        setScore((currentScore) => currentScore + 175);
        showPowerUpMessage('Fast Travel awarded bonus score.');
      }

      return;
    }

    if (powerUp.id === 'golden-passport') {
      markPowerUpUsed(powerUp.id);
      setGoldenPassportActive(true);
      setFlippedIds([]);
      showPowerUpMessage('Golden Passport is ready. Pick any hidden card.');
      return;
    }

    if (powerUp.id === 'shuffle') {
      setCards((currentCards) => {
        const eligibleIndexes: number[] = [];

        currentCards.forEach((card, index) => {
          if (!card || card.matched || flippedIds.includes(card.id) || temporaryRevealedIds.includes(card.id)) {
            return;
          }

          eligibleIndexes.push(index);
        });

        if (eligibleIndexes.length < 2) {
          return currentCards;
        }

        const eligibleCards = eligibleIndexes.map((index) => currentCards[index]).filter((card): card is MemoryCard => Boolean(card));
        const shuffledCards = shuffleCards(eligibleCards);

        if (shuffledCards.length !== eligibleIndexes.length) {
          return currentCards;
        }

        const nextCards = [...currentCards];

        eligibleIndexes.forEach((cardIndex, shuffledIndex) => {
          const replacementCard = shuffledCards[shuffledIndex];

          if (replacementCard) {
            nextCards[cardIndex] = replacementCard;
          }
        });

        return nextCards.every(Boolean) && nextCards.length === currentCards.length ? nextCards : currentCards;
      });
      markPowerUpUsed(powerUp.id);
      showPowerUpMessage('Hidden cards shuffled.');
      return;
    }

    markPowerUpUsed(powerUp.id);
    showPowerUpMessage('Souvenir Bonus reserved for victory.');
  };

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [status]);

  useEffect(() => {
    if (!isTimeAttack || status !== 'playing') {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          setStatus('lost');
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isTimeAttack, status]);

  const handleCardClick = (card: MemoryCard) => {
    if (status !== 'playing' || isResolving || card.matched || flippedIds.includes(card.id) || flippedIds.length >= 2) {
      return;
    }

    if (goldenPassportActive) {
      const matchingCard = cards.find((item) => !item.matched && item.id !== card.id && item.pairId === card.pairId);

      if (!matchingCard) {
        return;
      }

      const nextMoveCount = moves + 1;
      const nextCombo = combo + 1;
      const matchScore = 180 + nextCombo * 45;
      const nextMatches = matches + 1;
      const finalScore = score + matchScore;
      const finalBestCombo = Math.max(bestCombo, nextCombo);

      setGoldenPassportActive(false);
      setFlippedIds([card.id, matchingCard.id]);
      setMoves(nextMoveCount);
      setIsResolving(true);

      window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === card.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setScore(finalScore);
        setCombo(nextCombo);
        setBestCombo(finalBestCombo);
        setFlippedIds([]);
        setIsResolving(false);
        showPowerUpMessage('Golden Passport completed a pair.');

        const gameplayAchievementIds = ['first-match'];

        if (nextCombo >= 5) {
          gameplayAchievementIds.push('combo-master');
        }

        showAchievementUnlocks(onAchievementUnlock(gameplayAchievementIds).newlyUnlockedAchievements);

        if (nextMatches === pairCount) {
          const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);
          const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus);
          const progressUpdate = onVictory({
            ...rewards,
            bestCombo: finalBestCombo,
            elapsedSeconds,
            mismatchCount,
          });

          setScore(finalVictoryScore);
          setVictoryRewards({ ...rewards, leveledUp: progressUpdate.leveledUp });
          showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
          setStatus('won');
        } else if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
          setStatus('lost');
        }
      }, 360);

      return;
    }

    const nextFlippedIds = [...flippedIds, card.id];
    setFlippedIds(nextFlippedIds);

    if (nextFlippedIds.length !== 2) {
      return;
    }

    const nextMoveCount = moves + 1;
    setMoves(nextMoveCount);
    setIsResolving(true);

    const [firstCard, secondCard] = nextFlippedIds.map((cardId) => cards.find((item) => item.id === cardId));

    if (!firstCard || !secondCard) {
      setFlippedIds([]);
      setIsResolving(false);
      return;
    }

    if (firstCard.pairId === secondCard.pairId) {
      const nextCombo = combo + 1;
      const matchScore = 120 + nextCombo * 35 + (isTimeAttack ? timeLeft : 0);
      const nextMatches = matches + 1;
      const finalScore = score + matchScore;
      const finalBestCombo = Math.max(bestCombo, nextCombo);

      window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === firstCard.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setScore((currentScore) => currentScore + matchScore);
        setCombo(nextCombo);
        setBestCombo(finalBestCombo);
        setFlippedIds([]);
        setIsResolving(false);

        const gameplayAchievementIds = ['first-match'];

        if (nextCombo >= 5) {
          gameplayAchievementIds.push('combo-master');
        }

        showAchievementUnlocks(onAchievementUnlock(gameplayAchievementIds).newlyUnlockedAchievements);

        if (nextMatches === pairCount) {
          const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);
          const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus);
          const progressUpdate = onVictory({
            ...rewards,
            bestCombo: finalBestCombo,
            elapsedSeconds,
            mismatchCount,
          });

          setScore(finalVictoryScore);
          setVictoryRewards({ ...rewards, leveledUp: progressUpdate.leveledUp });
          showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
          setStatus('won');
        } else if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
          setStatus('lost');
        }
      }, 220);

      return;
    }

    window.setTimeout(() => {
      setCombo(0);
      setMismatchCount((currentMismatchCount) => currentMismatchCount + 1);

      if (!isZen) {
        setScore((currentScore) => Math.max(0, currentScore - 25));
      }

      if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
        setStatus('lost');
      }

      setFlippedIds([]);
      setIsResolving(false);
    }, mismatchDelayMs);
  };

  const confirmGiveUp = () => {
    setShowGiveUpConfirm(false);
    setGoldenPassportActive(false);
    setTemporaryRevealedIds([]);
    setFlippedIds([]);
    setIsResolving(false);
    onLoss();
    setStatus('lost');
  };

  const boardStyle = {
    '--board-columns': boardConfig.columns,
    '--world-primary': world.theme.primary,
    '--world-secondary': world.theme.secondary,
    '--world-accent': world.theme.accent,
  } as CSSProperties;

  return (
    <section className="screen gameplay-screen">
      <ScreenHeader
        title={getModeLabel(mode)}
        subtitle={getGameplaySubtitle(mode, world, boardConfig)}
        action={<button className="small-button" onClick={() => onNavigate('mode-select')} type="button">Modes</button>}
      />

      <div className="gameplay-shell" style={boardStyle}>
        <div className="game-status-ribbon">
          <span className="badge destination-badge">{world.difficulty}</span>
          <span className="badge">{mode.name}</span>
          {isSurvival ? <span className="badge danger-badge">{remainingMoves} moves left</span> : null}
          {isTimeAttack ? <span className="badge timer-badge">{formatTime(timeLeft)}</span> : null}
        </div>

        <div className="game-hud">
          <span><strong>{moves}</strong> Moves</span>
          <span><strong>{matches}/{pairCount}</strong> Matches</span>
          <span><strong>{score}</strong> Score</span>
          <span><strong>{combo}x</strong> Combo</span>
          <span><strong>{bestCombo}x</strong> Best</span>
          <span><strong>{isTimeAttack ? formatTime(timeLeft) : isSurvival ? remainingMoves : '--'}</strong> {isTimeAttack ? 'Timer' : isSurvival ? 'Moves Left' : 'Calm'}</span>
          <span><strong>{formatDuration(elapsedSeconds)}</strong> Time</span>
        </div>

        {powerUpsEnabled ? (
          <div className="power-up-panel">
            <div className="power-up-header">
              <span className="eyebrow">Travel Gear</span>
              <strong>{goldenPassportActive ? 'Golden Passport active' : 'Once per game'}</strong>
            </div>
            <div className="power-up-bar">
              {powerUps.map((powerUp) => {
                const isUsed = usedPowerUps.includes(powerUp.id);

                return (
                  <button
                    className={isUsed ? 'power-up-card used' : 'power-up-card'}
                    disabled={isUsed || status !== 'playing' || isResolving || goldenPassportActive || flippedIds.length > 0}
                    key={powerUp.id}
                    onClick={() => handlePowerUp(powerUp)}
                    title={`${powerUp.name}: ${powerUp.description}`}
                    type="button"
                  >
                    <span className="power-up-icon">{powerUp.icon}</span>
                    <strong>{powerUp.name}</strong>
                    <small>{isUsed ? 'Used' : powerUp.description}</small>
                  </button>
                );
              })}
            </div>
            {powerUpMessage ? <div className="power-up-message">{powerUpMessage}</div> : null}
          </div>
        ) : null}

        <div className="memory-grid playable-board" role="grid">
          {cards.map((card, index) => {
            if (!card) {
              return (
                <button
                  aria-label="Unavailable memory card"
                  className="memory-card playable card-invalid"
                  disabled
                  key={`invalid-card-${index}`}
                  type="button"
                >
                  <span className="card-inner">
                    <span className="card-face card-back">
                      <span className="card-route-mark" />
                    </span>
                  </span>
                </button>
              );
            }

            const isFaceUp = card.matched || flippedIds.includes(card.id) || temporaryRevealedIds.includes(card.id);

            return (
              <button
                aria-label={`${isFaceUp ? card.symbol : 'Hidden'} memory card`}
                className={isFaceUp ? 'memory-card playable flipped' : 'memory-card playable'}
                disabled={status !== 'playing' || isResolving || card.matched}
                key={card.id}
                onClick={() => handleCardClick(card)}
                type="button"
              >
                <span className="card-inner">
                  <span className="card-face card-back">
                    <span className="card-route-mark" />
                  </span>
                  <span className="card-face card-front">
                    <strong>{card.label}</strong>
                    <small>{card.symbol}</small>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="game-action-row">
          <button className="secondary-button" onClick={onRestart} type="button">Restart</button>
          <button
            className="secondary-button danger-action"
            disabled={status !== 'playing'}
            onClick={() => setShowGiveUpConfirm(true)}
            type="button"
          >
            Give Up
          </button>
          <button className="primary-button" onClick={() => onNavigate('mode-select')} type="button">Back to Modes</button>
        </div>
      </div>

      {newlyUnlockedAchievements.length > 0 ? (
        <div className="achievement-toast-stack" aria-live="polite">
          {newlyUnlockedAchievements.slice(-3).map((achievement) => (
            <div className="achievement-toast" key={achievement.id}>
              <span className="achievement-toast-medal" aria-hidden="true">A</span>
              <div>
                <strong>Achievement Unlocked</strong>
                <span>{achievement.title}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showGiveUpConfirm ? (
        <div className="victory-overlay" role="dialog" aria-modal="true" aria-label="Give up confirmation">
          <div className="victory-card confirm-card">
            <span className="badge danger-badge">End Match</span>
            <h2>Give Up?</h2>
            <p>This will end the current match as a loss. No XP, coins, or victory achievements will be awarded.</p>
            <div className="game-action-row">
              <button className="secondary-button" onClick={() => setShowGiveUpConfirm(false)} type="button">
                Continue Playing
              </button>
              <button className="primary-button danger-action" onClick={confirmGiveUp} type="button">
                Give Up
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status !== 'playing' ? (
        <div className="victory-overlay" role="dialog" aria-modal="true" aria-label={status === 'won' ? 'Victory' : 'Game over'}>
          <div className="victory-card">
            <span className={status === 'won' ? 'badge premium-badge' : 'badge danger-badge'}>
              {status === 'won' ? 'Route Complete' : 'Route Failed'}
            </span>
            {status === 'won' && displayedRewards.leveledUp ? <span className="badge timer-badge level-up-badge">Level Up</span> : null}
            <h2>{status === 'won' ? 'Victory!' : isTimeAttack ? 'Time Up' : isSurvival ? 'No Moves Left' : 'Match Ended'}</h2>
            <p>
              {status === 'won'
                ? `You completed ${world.name} in ${mode.name}.`
                : 'Restart the route or return to modes to try a different rule set.'}
            </p>
            <div className="victory-stats">
              <span><strong>{score}</strong> Score</span>
              <span><strong>{moves}</strong> Moves</span>
              <span><strong>{bestCombo}x</strong> Best Combo</span>
              <span><strong>{formatDuration(elapsedSeconds)}</strong> Time</span>
              <span><strong>{status === 'won' ? displayedRewards.earnedXp : 0}</strong> XP</span>
              <span><strong>{status === 'won' ? displayedRewards.earnedCoins : 0}</strong> Coins</span>
            </div>
            <div className="game-action-row">
              <button className="secondary-button" onClick={onRestart} type="button">Restart</button>
              <button className="primary-button" onClick={() => onNavigate('mode-select')} type="button">Back to Modes</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
