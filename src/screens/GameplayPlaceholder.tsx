import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Achievement, GameMode, PlayerProfile, PowerUpId, ScreenId, World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import type {
  AchievementProgress,
  DailyChallengeGameResult,
  DailyChallengeUpdate,
  ProgressUpdate,
  ShopActionResult,
  VictoryProgress,
} from '../utils/progression';
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

type PlayerTurn = 'player' | 'ai';

type AiDifficulty = 'easy' | 'medium' | 'hard';

type AiOutcome = 'player' | 'ai' | 'draw';

type DuelTurn = 'player1' | 'player2';

type DuelOutcome = 'player1' | 'player2' | 'draw';

type PowerUp = {
  id: PowerUpId;
  icon: string;
  name: string;
  description: string;
  usage: string;
};

type GameplayPlaceholderProps = {
  duelPlayers: { player1: string; player2: string };
  mode: GameMode;
  profile: PlayerProfile;
  world: World;
  onAchievementUnlock: (achievementIds: string[]) => AchievementProgress;
  onDailyChallengeCheck: (result: DailyChallengeGameResult) => DailyChallengeUpdate;
  onLoss: () => void;
  onNavigate: (screen: ScreenId) => void;
  onUsePowerUp: (powerUpId: PowerUpId) => ShopActionResult;
  onVictory: (victory: VictoryProgress) => ProgressUpdate;
};

type VictoryRewards = {
  earnedCoins: number;
  earnedXp: number;
  leveledUp: boolean;
};

type AiMemoryEntry = Pick<MemoryCard, 'pairId' | 'symbol' | 'label'>;

const mismatchDelayMs = 760;
const souvenirScoreBonus = 250;
const souvenirCoinBonus = 120;

const powerUps: PowerUp[] = [
  {
    id: 'compass',
    icon: 'CP',
    name: 'Compass',
    description: 'Reveals one unmatched pair for 2 seconds.',
    usage: 'Use before flipping a card when you need a guaranteed pair location.',
  },
  {
    id: 'camera',
    icon: 'CA',
    name: 'Camera',
    description: 'Reveals all unmatched cards for 3 seconds.',
    usage: 'Use early or after a shuffle to quickly study the board.',
  },
  {
    id: 'fast-travel',
    icon: 'FT',
    name: 'Fast Travel',
    description: 'Adds +15 seconds in Time Attack, gives bonus score in other modes.',
    usage: 'Use during your turn when the timer is low or you want a score boost.',
  },
  {
    id: 'golden-passport',
    icon: 'GP',
    name: 'Golden Passport',
    description: 'The next selected hidden card automatically finds its matching pair.',
    usage: 'Use before selecting a hidden card to claim one pair immediately.',
  },
  {
    id: 'shuffle',
    icon: 'SH',
    name: 'Shuffle',
    description: 'Shuffles only hidden unmatched cards. Matched cards stay in place.',
    usage: 'Use when the remaining layout is hard to read and you want a fresh arrangement.',
  },
  {
    id: 'souvenir',
    icon: 'SB',
    name: 'Souvenir Bonus',
    description: 'Adds bonus score now and bonus coins after victory.',
    usage: 'Use before finishing the game to improve your final reward.',
  },
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

function getRandomCard(cards: MemoryCard[]): MemoryCard | null {
  if (cards.length === 0) {
    return null;
  }

  return cards[Math.floor(Math.random() * cards.length)] ?? null;
}

function shouldUseKnownPair(difficulty: AiDifficulty): boolean {
  if (difficulty === 'easy') {
    return Math.random() < 0.3;
  }

  if (difficulty === 'hard') {
    return Math.random() < 0.95;
  }

  return true;
}

function chooseAiCards(cards: MemoryCard[], memory: Record<string, AiMemoryEntry>, difficulty: AiDifficulty): MemoryCard[] {
  const availableCards = cards.filter((card) => !card.matched);
  const rememberedAvailableCards = availableCards.filter((card) => memory[card.id]);
  const knownPairs: MemoryCard[][] = [];

  rememberedAvailableCards.forEach((card) => {
    if (knownPairs.some((pair) => pair.some((item) => item.id === card.id))) {
      return;
    }

    const matchingCard = rememberedAvailableCards.find((item) => item.id !== card.id && item.pairId === card.pairId);

    if (matchingCard) {
      knownPairs.push([card, matchingCard]);
    }
  });

  if (knownPairs.length > 0 && shouldUseKnownPair(difficulty)) {
    return knownPairs[Math.floor(Math.random() * knownPairs.length)] ?? [];
  }

  const firstCard =
    difficulty === 'hard' && rememberedAvailableCards.length > 0 && Math.random() < 0.7
      ? getRandomCard(rememberedAvailableCards)
      : getRandomCard(availableCards);

  if (!firstCard) {
    return [];
  }

  const secondCard = getRandomCard(availableCards.filter((card) => card.id !== firstCard.id));

  return secondCard ? [firstCard, secondCard] : [firstCard];
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

function getWorldAssetId(worldId: string): string {
  if (worldId === 'tropics') {
    return 'tropical';
  }

  if (worldId === 'mountains') {
    return 'mountain';
  }

  return worldId;
}

function getCardFaceAssetPath(world: World, symbol: string): string {
  const worldAssetId = getWorldAssetId(world.id);
  const symbolAssetId = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `/assets/cards/${worldAssetId}-${symbolAssetId}.png`;
}

function getPowerUpAssetPath(powerUpId: PowerUpId): string {
  return `/assets/icons/powerup-${powerUpId}.png`;
}

function getModeLabel(mode: GameMode): string {
  if (mode.id === 'challenge') {
    return 'Challenge Route';
  }

  if (mode.id === 'ai') {
    return 'Player vs AI';
  }

  if (mode.id === 'duel') {
    return '2 Player Duel';
  }

  return mode.name;
}

function getGameplaySubtitle(mode: GameMode, world: World, boardConfig: BoardConfig): string {
  const routeLabel = `${world.name} - ${boardConfig.columns}x${boardConfig.rows} memory route`;

  if (mode.id === 'survival') {
    return `${routeLabel}. Complete the board before you run out of moves.`;
  }

  if (mode.id === 'duel') {
    return `${routeLabel}. Pass the device and claim more pairs than your rival.`;
  }

  return routeLabel;
}

function calculateRewards(score: number, bestCombo: number, hasSouvenirBonus: boolean): Omit<VictoryRewards, 'leveledUp'> {
  return {
    earnedXp: Math.max(40, Math.round(score / 8) + bestCombo * 12),
    earnedCoins: Math.max(20, Math.round(score / 18) + bestCombo * 4) + (hasSouvenirBonus ? souvenirCoinBonus : 0),
  };
}

export function GameplayPlaceholder({
  duelPlayers,
  mode,
  profile,
  world,
  onAchievementUnlock,
  onDailyChallengeCheck,
  onLoss,
  onNavigate,
  onUsePowerUp,
  onVictory,
}: GameplayPlaceholderProps) {
  const [restartKey, setRestartKey] = useState(0);

  return (
    <GameplaySession
      key={`${world.id}-${mode.id}-${restartKey}`}
      duelPlayers={duelPlayers}
      mode={mode}
      onAchievementUnlock={onAchievementUnlock}
      onDailyChallengeCheck={onDailyChallengeCheck}
      onLoss={onLoss}
      onNavigate={onNavigate}
      onRestart={() => setRestartKey((currentKey) => currentKey + 1)}
      onUsePowerUp={onUsePowerUp}
      onVictory={onVictory}
      profile={profile}
      world={world}
    />
  );
}

type GameplaySessionProps = GameplayPlaceholderProps & {
  onRestart: () => void;
};

function GameplaySession({
  mode,
  duelPlayers,
  profile,
  world,
  onAchievementUnlock,
  onDailyChallengeCheck,
  onLoss,
  onNavigate,
  onRestart,
  onUsePowerUp,
  onVictory,
}: GameplaySessionProps) {
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
  const [souvenirBonusActive, setSouvenirBonusActive] = useState(false);
  const [powerUpsUsedCount, setPowerUpsUsedCount] = useState(0);
  const [temporaryRevealedIds, setTemporaryRevealedIds] = useState<string[]>([]);
  const [goldenPassportActive, setGoldenPassportActive] = useState(false);
  const [powerUpMessage, setPowerUpMessage] = useState('');
  const [activePowerUpInfo, setActivePowerUpInfo] = useState<PowerUpId | null>(null);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [currentTurn, setCurrentTurn] = useState<PlayerTurn>('player');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('medium');
  const [aiMemory, setAiMemory] = useState<Record<string, AiMemoryEntry>>({});
  const [playerPairs, setPlayerPairs] = useState(0);
  const [aiPairs, setAiPairs] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiOutcome, setAiOutcome] = useState<AiOutcome | null>(null);
  const [duelTurn, setDuelTurn] = useState<DuelTurn>('player1');
  const [duelPlayer1Pairs, setDuelPlayer1Pairs] = useState(0);
  const [duelPlayer2Pairs, setDuelPlayer2Pairs] = useState(0);
  const [duelOutcome, setDuelOutcome] = useState<DuelOutcome | null>(null);
  const [duelMessage, setDuelMessage] = useState(`${duelPlayers.player1.trim() || 'Player 1'} starts.`);
  const [dailyChallengeReward, setDailyChallengeReward] = useState<DailyChallengeUpdate | null>(null);
  const aiTurnInProgressRef = useRef(false);
  const aiTimersRef = useRef<number[]>([]);
  const powerUpPanelRef = useRef<HTMLDivElement | null>(null);

  const pairCount = cards.length / 2;
  const isAiMode = mode.id === 'ai';
  const isDuelMode = mode.id === 'duel';
  const isTimeAttack = mode.id === 'time-attack';
  const isSurvival = mode.id === 'survival';
  const isZen = mode.id === 'zen';
  const remainingMoves = Math.max(0, boardConfig.survivalMaxMoves - moves);
  const hasSouvenirBonus = souvenirBonusActive;
  const displayedRewards = victoryRewards ?? { ...calculateRewards(score, bestCombo, hasSouvenirBonus), leveledUp: false };
  const powerUpsEnabled = !isZen && !isDuelMode;
  const isPlayerTurn = !isAiMode || currentTurn === 'player';
  const duelPlayer1Name = duelPlayers.player1.trim() || 'Player 1';
  const duelPlayer2Name = duelPlayers.player2.trim() || 'Player 2';
  const currentDuelPlayerName = duelTurn === 'player1' ? duelPlayer1Name : duelPlayer2Name;

  useEffect(() => {
    if (!activePowerUpInfo) {
      return undefined;
    }

    const closeInfoOnOutsideClick = (event: PointerEvent) => {
      if (!powerUpPanelRef.current?.contains(event.target as Node)) {
        setActivePowerUpInfo(null);
      }
    };

    document.addEventListener('pointerdown', closeInfoOnOutsideClick);

    return () => {
      document.removeEventListener('pointerdown', closeInfoOnOutsideClick);
    };
  }, [activePowerUpInfo]);

  const latestAiStateRef = useRef({
    aiDifficulty,
    aiMemory,
    aiPairs,
    bestCombo,
    cards,
    matches,
    mismatchCount,
    moves,
    playerPairs,
    score,
  });

  useEffect(() => {
    latestAiStateRef.current = {
      aiDifficulty,
      aiMemory,
      aiPairs,
      bestCombo,
      cards,
      matches,
      mismatchCount,
      moves,
      playerPairs,
      score,
    };
  }, [aiDifficulty, aiMemory, aiPairs, bestCombo, cards, matches, mismatchCount, moves, playerPairs, score]);

  const showAchievementUnlocks = useCallback((nextAchievements: Achievement[]) => {
    if (nextAchievements.length === 0) {
      return;
    }

    setNewlyUnlockedAchievements((currentAchievements) => {
      const currentIds = new Set(currentAchievements.map((achievement) => achievement.id));
      const uniqueNextAchievements = nextAchievements.filter((achievement) => !currentIds.has(achievement.id));

      return [...currentAchievements, ...uniqueNextAchievements];
    });
  }, []);

  const showPowerUpMessage = (message: string) => {
    setPowerUpMessage(message);
    window.setTimeout(() => setPowerUpMessage(''), 2200);
  };

  const checkDailyChallenge = useCallback((result: DailyChallengeGameResult) => {
    const update = onDailyChallengeCheck(result);

    if (update.dailyMissionsCompleted.length > 0 || update.dailyChestUnlocked || update.weeklyChallengeCompleted) {
      setDailyChallengeReward(update);
    }
  }, [onDailyChallengeCheck]);

  const completeGame = useCallback((won: boolean, overrides?: Partial<DailyChallengeGameResult>) => {
    checkDailyChallenge({
      aiDifficulty: isAiMode ? aiDifficulty : undefined,
      aiOutcome: isAiMode ? aiOutcome ?? undefined : undefined,
      bestCombo,
      elapsedSeconds,
      mismatchCount,
      modeId: mode.id,
      powerUpsUsed: powerUpsUsedCount,
      score,
      won,
      ...overrides,
    });
  }, [
    aiDifficulty,
    aiOutcome,
    bestCombo,
    checkDailyChallenge,
    elapsedSeconds,
    isAiMode,
    mismatchCount,
    mode.id,
    powerUpsUsedCount,
    score,
  ]);

  const consumeTravelGear = (powerUpId: PowerUpId): boolean => {
    const result = onUsePowerUp(powerUpId);

    if (!result.ok) {
      showPowerUpMessage(result.message);
      return false;
    }

    setPowerUpsUsedCount((currentCount) => currentCount + 1);
    return true;
  };

  const rememberSeenCards = useCallback((seenCards: MemoryCard[]) => {
    if (!isAiMode) {
      return;
    }

    setAiMemory((currentMemory) => {
      const nextMemory = { ...currentMemory };

      seenCards.forEach((card) => {
        nextMemory[card.id] = {
          label: card.label,
          pairId: card.pairId,
          symbol: card.symbol,
        };
      });

      return nextMemory;
    });
  }, [isAiMode]);

  const finishDuelGame = useCallback((nextPlayer1Pairs: number, nextPlayer2Pairs: number) => {
    const outcome: DuelOutcome =
      nextPlayer1Pairs > nextPlayer2Pairs ? 'player1' : nextPlayer2Pairs > nextPlayer1Pairs ? 'player2' : 'draw';

    setDuelOutcome(outcome);
    setStatus('won');
  }, []);

  const finishAiGame = useCallback((
    nextPlayerPairs: number,
    nextAiPairs: number,
    finalScore: number,
    finalBestCombo: number,
    finalMismatchCount: number,
  ) => {
    const outcome: AiOutcome =
      nextPlayerPairs > nextAiPairs ? 'player' : nextAiPairs > nextPlayerPairs ? 'ai' : 'draw';

    setAiOutcome(outcome);

    if (outcome === 'ai') {
      onLoss();
      completeGame(false, {
        aiOutcome: outcome,
        bestCombo: finalBestCombo,
        mismatchCount: finalMismatchCount,
        score: finalScore,
      });
      setStatus('lost');
      return;
    }

    const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);
    const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus);
    const progressUpdate = onVictory({
      ...rewards,
      bestCombo: finalBestCombo,
      elapsedSeconds,
      mismatchCount: finalMismatchCount,
    });

    setScore(finalVictoryScore);
    setVictoryRewards({ ...rewards, leveledUp: progressUpdate.leveledUp });
    showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
    completeGame(true, {
      aiOutcome: outcome,
      bestCombo: finalBestCombo,
      mismatchCount: finalMismatchCount,
      score: finalVictoryScore,
    });
    setStatus('won');
  }, [completeGame, elapsedSeconds, hasSouvenirBonus, onLoss, onVictory, showAchievementUnlocks]);

  const finishSoloVictory = useCallback((finalScore: number, finalBestCombo: number, finalMismatchCount: number) => {
    const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);
    const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus);
    const progressUpdate = onVictory({
      ...rewards,
      bestCombo: finalBestCombo,
      elapsedSeconds,
      mismatchCount: finalMismatchCount,
    });

    setScore(finalVictoryScore);
    setVictoryRewards({ ...rewards, leveledUp: progressUpdate.leveledUp });
    showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
    completeGame(true, {
      bestCombo: finalBestCombo,
      mismatchCount: finalMismatchCount,
      score: finalVictoryScore,
    });
    setStatus('won');
  }, [completeGame, elapsedSeconds, hasSouvenirBonus, onVictory, showAchievementUnlocks]);

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
      !isPlayerTurn ||
      isResolving ||
      goldenPassportActive ||
      flippedIds.length > 0 ||
      (powerUp.id === 'souvenir' && souvenirBonusActive)
    ) {
      return;
    }

    if ((profile.powerUpInventory[powerUp.id] ?? 0) <= 0) {
      showPowerUpMessage(`Buy ${powerUp.name} in the Travel Gear Shop first.`);
      return;
    }

    if (powerUp.id === 'compass') {
      const pairCard = findUnmatchedPair(cards);

      if (!pairCard) {
        return;
      }

      const pairIds = cards.filter((card) => !card.matched && card.pairId === pairCard.pairId).map((card) => card.id);
      if (!consumeTravelGear(powerUp.id)) {
        return;
      }

      revealTemporarily(pairIds, 2000);
      showPowerUpMessage('Compass revealed one route pair.');
      return;
    }

    if (powerUp.id === 'camera') {
      if (!consumeTravelGear(powerUp.id)) {
        return;
      }

      revealTemporarily(cards.filter((card) => !card.matched).map((card) => card.id), 3000);
      showPowerUpMessage('Camera previewed the whole board.');
      return;
    }

    if (powerUp.id === 'fast-travel') {
      if (!consumeTravelGear(powerUp.id)) {
        return;
      }

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
      if (!consumeTravelGear(powerUp.id)) {
        return;
      }

      setGoldenPassportActive(true);
      setFlippedIds([]);
      showPowerUpMessage('Golden Passport is ready. Pick any hidden card.');
      return;
    }

    if (powerUp.id === 'shuffle') {
      const eligibleCards = cards.filter(
        (card) => !card.matched && !flippedIds.includes(card.id) && !temporaryRevealedIds.includes(card.id),
      );

      if (eligibleCards.length < 2) {
        return;
      }

      if (!consumeTravelGear(powerUp.id)) {
        return;
      }

      setCards((currentCards) => {
        const eligibleIndexes: number[] = [];

        currentCards.forEach((card, index) => {
          if (!card || card.matched || flippedIds.includes(card.id) || temporaryRevealedIds.includes(card.id)) {
            return;
          }

          eligibleIndexes.push(index);
        });

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
      showPowerUpMessage('Hidden cards shuffled.');
      return;
    }

    if (!consumeTravelGear(powerUp.id)) {
      return;
    }

    setSouvenirBonusActive(true);
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
          completeGame(false);
          setStatus('lost');
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [completeGame, isTimeAttack, status]);

  const handleCardClick = (card: MemoryCard) => {
    if (
      status !== 'playing' ||
      isResolving ||
      aiThinking ||
      !isPlayerTurn ||
      card.matched ||
      flippedIds.includes(card.id) ||
      flippedIds.length >= 2
    ) {
      return;
    }

    rememberSeenCards([card]);

    if (goldenPassportActive) {
      const matchingCard = cards.find((item) => !item.matched && item.id !== card.id && item.pairId === card.pairId);

      if (!matchingCard) {
        return;
      }

      rememberSeenCards([matchingCard]);

      const nextMoveCount = moves + 1;
      const nextCombo = combo + 1;
      const matchScore = 180 + nextCombo * 45;
      const nextMatches = matches + 1;
      const finalScore = score + matchScore;
      const finalBestCombo = Math.max(bestCombo, nextCombo);
      const nextPlayerPairs = isAiMode ? playerPairs + 1 : playerPairs;
      const nextDuelPlayer1Pairs = isDuelMode && duelTurn === 'player1' ? duelPlayer1Pairs + 1 : duelPlayer1Pairs;
      const nextDuelPlayer2Pairs = isDuelMode && duelTurn === 'player2' ? duelPlayer2Pairs + 1 : duelPlayer2Pairs;

      setGoldenPassportActive(false);
      setFlippedIds([card.id, matchingCard.id]);
      setMoves(nextMoveCount);
      setIsResolving(true);

      window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === card.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setPlayerPairs(nextPlayerPairs);
        setDuelPlayer1Pairs(nextDuelPlayer1Pairs);
        setDuelPlayer2Pairs(nextDuelPlayer2Pairs);
        setScore(finalScore);
        setCombo(nextCombo);
        setBestCombo(finalBestCombo);
        setFlippedIds([]);
        setIsResolving(false);
        showPowerUpMessage('Golden Passport completed a pair.');
        if (isDuelMode) {
          setDuelMessage(`${currentDuelPlayerName} found a pair and goes again.`);
        }

        const gameplayAchievementIds = ['first-match'];

        if (nextCombo >= 5) {
          gameplayAchievementIds.push('combo-master');
        }

        if (!isDuelMode) {
          showAchievementUnlocks(onAchievementUnlock(gameplayAchievementIds).newlyUnlockedAchievements);
        }

        if (nextMatches === pairCount) {
          if (isDuelMode) {
            finishDuelGame(nextDuelPlayer1Pairs, nextDuelPlayer2Pairs);
          } else if (isAiMode) {
            finishAiGame(nextPlayerPairs, aiPairs, finalScore, finalBestCombo, mismatchCount);
          } else {
            finishSoloVictory(finalScore, finalBestCombo, mismatchCount);
          }
        } else if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
          completeGame(false, {
            bestCombo: finalBestCombo,
            score: finalScore,
          });
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
      const nextPlayerPairs = isAiMode ? playerPairs + 1 : playerPairs;
      const nextDuelPlayer1Pairs = isDuelMode && duelTurn === 'player1' ? duelPlayer1Pairs + 1 : duelPlayer1Pairs;
      const nextDuelPlayer2Pairs = isDuelMode && duelTurn === 'player2' ? duelPlayer2Pairs + 1 : duelPlayer2Pairs;

      window.setTimeout(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === firstCard.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setPlayerPairs(nextPlayerPairs);
        setDuelPlayer1Pairs(nextDuelPlayer1Pairs);
        setDuelPlayer2Pairs(nextDuelPlayer2Pairs);
        setScore((currentScore) => currentScore + matchScore);
        setCombo(nextCombo);
        setBestCombo(finalBestCombo);
        setFlippedIds([]);
        setIsResolving(false);
        if (isDuelMode) {
          setDuelMessage(`${currentDuelPlayerName} found a pair and goes again.`);
        }

        const gameplayAchievementIds = ['first-match'];

        if (nextCombo >= 5) {
          gameplayAchievementIds.push('combo-master');
        }

        if (!isDuelMode) {
          showAchievementUnlocks(onAchievementUnlock(gameplayAchievementIds).newlyUnlockedAchievements);
        }

        if (nextMatches === pairCount) {
          if (isDuelMode) {
            finishDuelGame(nextDuelPlayer1Pairs, nextDuelPlayer2Pairs);
          } else if (isAiMode) {
            finishAiGame(nextPlayerPairs, aiPairs, finalScore, finalBestCombo, mismatchCount);
          } else {
            finishSoloVictory(finalScore, finalBestCombo, mismatchCount);
          }
        } else if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
          completeGame(false, {
            bestCombo: finalBestCombo,
            score: finalScore,
          });
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
        completeGame(false, {
          mismatchCount: mismatchCount + 1,
        });
        setStatus('lost');
      }

      setFlippedIds([]);
      if (isDuelMode) {
        const nextTurn: DuelTurn = duelTurn === 'player1' ? 'player2' : 'player1';
        const nextPlayerName = nextTurn === 'player1' ? duelPlayer1Name : duelPlayer2Name;

        setDuelTurn(nextTurn);
        setDuelMessage(`No match. ${nextPlayerName}'s turn.`);
      } else if (isAiMode) {
        setCurrentTurn('ai');
      }
      setIsResolving(false);
    }, mismatchDelayMs);
  };

  useEffect(() => {
    return () => {
      aiTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      aiTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (
      !isAiMode ||
      status !== 'playing' ||
      currentTurn !== 'ai' ||
      isResolving ||
      flippedIds.length > 0 ||
      aiTurnInProgressRef.current
    ) {
      return;
    }

    const snapshot = latestAiStateRef.current;
    const aiSelection = chooseAiCards(snapshot.cards, snapshot.aiMemory, snapshot.aiDifficulty);

    if (aiSelection.length < 2) {
      return;
    }

    const [firstCard, secondCard] = aiSelection;
    aiTurnInProgressRef.current = true;
    setAiThinking(true);

    const firstFlipTimer = window.setTimeout(() => {
      setAiThinking(false);
      setFlippedIds([firstCard.id]);
      rememberSeenCards([firstCard]);

      const secondFlipTimer = window.setTimeout(() => {
        const turnSnapshot = latestAiStateRef.current;
        const nextMoveCount = turnSnapshot.moves + 1;
        const nextFlippedIds = [firstCard.id, secondCard.id];

        setFlippedIds(nextFlippedIds);
        rememberSeenCards([secondCard]);
        setMoves(nextMoveCount);
        setIsResolving(true);

        if (firstCard.pairId === secondCard.pairId) {
          const nextMatches = turnSnapshot.matches + 1;
          const nextAiPairs = turnSnapshot.aiPairs + 1;

          const resolveTimer = window.setTimeout(() => {
            setCards((currentCards) =>
              currentCards.map((item) => (item.pairId === firstCard.pairId ? { ...item, matched: true } : item)),
            );
            setMatches(nextMatches);
            setAiPairs(nextAiPairs);
            setFlippedIds([]);
            setIsResolving(false);
            aiTurnInProgressRef.current = false;

            if (nextMatches === pairCount) {
              finishAiGame(
                turnSnapshot.playerPairs,
                nextAiPairs,
                turnSnapshot.score,
                turnSnapshot.bestCombo,
                turnSnapshot.mismatchCount,
              );
            }
          }, 420);
          aiTimersRef.current.push(resolveTimer);

          return;
        }

        const nextMismatchCount = turnSnapshot.mismatchCount + 1;

        const resolveTimer = window.setTimeout(() => {
          setCombo(0);
          setMismatchCount(nextMismatchCount);
          setFlippedIds([]);
          setCurrentTurn('player');
          setIsResolving(false);
          aiTurnInProgressRef.current = false;
        }, mismatchDelayMs);
        aiTimersRef.current.push(resolveTimer);
      }, 680);
      aiTimersRef.current.push(secondFlipTimer);
    }, 700);
    aiTimersRef.current.push(firstFlipTimer);
  }, [
    currentTurn,
    finishAiGame,
    flippedIds.length,
    isAiMode,
    isResolving,
    pairCount,
    rememberSeenCards,
    status,
  ]);

  const confirmGiveUp = () => {
    setShowGiveUpConfirm(false);
    setGoldenPassportActive(false);
    setTemporaryRevealedIds([]);
    setFlippedIds([]);
    setIsResolving(false);
    if (isDuelMode) {
      setDuelOutcome('draw');
      setStatus('lost');
      return;
    }

    onLoss();
    completeGame(false);
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
          {isAiMode ? <span className="badge timer-badge">{currentTurn === 'player' ? 'Player Turn' : 'AI Turn'}</span> : null}
          {isDuelMode ? <span className="badge timer-badge">{currentDuelPlayerName}'s Turn</span> : null}
          {isSurvival ? <span className="badge danger-badge">{remainingMoves} moves left</span> : null}
          {isTimeAttack ? <span className="badge timer-badge">{formatTime(timeLeft)}</span> : null}
        </div>

        {isAiMode ? (
          <div className="ai-duel-panel">
            <div>
              <span className="eyebrow">AI Difficulty</span>
              <div className="ai-difficulty-selector" role="group" aria-label="AI difficulty">
                {(['easy', 'medium', 'hard'] as AiDifficulty[]).map((difficulty) => (
                  <button
                    className={aiDifficulty === difficulty ? 'selected' : ''}
                    disabled={status !== 'playing' || isResolving || aiThinking}
                    key={difficulty}
                    onClick={() => setAiDifficulty(difficulty)}
                    type="button"
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
            <div className="turn-indicator" aria-live="polite">
              <span className="eyebrow">Current Turn</span>
              <strong>{aiThinking ? 'AI is thinking...' : currentTurn === 'player' ? 'Player' : 'AI'}</strong>
            </div>
          </div>
        ) : null}

        {isDuelMode ? (
          <div className="duel-status-panel" aria-live="polite">
            <div className={duelTurn === 'player1' ? 'duel-player-chip active' : 'duel-player-chip'}>
              <span className="eyebrow">{duelPlayer1Name}</span>
              <strong>{duelPlayer1Pairs} pairs</strong>
            </div>
            <div className={duelTurn === 'player2' ? 'duel-player-chip active' : 'duel-player-chip'}>
              <span className="eyebrow">{duelPlayer2Name}</span>
              <strong>{duelPlayer2Pairs} pairs</strong>
            </div>
            <p>{duelMessage}</p>
          </div>
        ) : null}

        <div className="game-hud">
          <span><strong>{moves}</strong> Moves</span>
          <span><strong>{isDuelMode ? `${duelPlayer1Pairs}/${pairCount}` : isAiMode ? `${playerPairs}/${pairCount}` : `${matches}/${pairCount}`}</strong> {isDuelMode ? duelPlayer1Name : isAiMode ? 'Player Pairs' : 'Matches'}</span>
          {isDuelMode ? <span><strong>{duelPlayer2Pairs}/{pairCount}</strong> {duelPlayer2Name}</span> : null}
          {isAiMode ? <span><strong>{aiPairs}/{pairCount}</strong> AI Pairs</span> : null}
          <span><strong>{score}</strong> Score</span>
          <span><strong>{combo}x</strong> Combo</span>
          <span><strong>{bestCombo}x</strong> Best</span>
          <span><strong>{isTimeAttack ? formatTime(timeLeft) : isSurvival ? remainingMoves : '--'}</strong> {isTimeAttack ? 'Timer' : isSurvival ? 'Moves Left' : 'Calm'}</span>
          <span><strong>{formatDuration(elapsedSeconds)}</strong> Time</span>
        </div>

        {powerUpsEnabled ? (
          <div
            className="power-up-panel"
            onPointerDown={(event) => {
              if (!activePowerUpInfo) {
                return;
              }

              const target = event.target as HTMLElement;

              if (!target.closest('.power-up-info-popover') && !target.closest('.power-up-info-button')) {
                setActivePowerUpInfo(null);
              }
            }}
            ref={powerUpPanelRef}
          >
            <div className="power-up-header">
              <span className="eyebrow">Travel Gear</span>
              <strong>{goldenPassportActive ? 'Golden Passport active' : 'Once per game'}</strong>
            </div>
            <div className="power-up-bar">
              {powerUps.map((powerUp) => {
                const quantity = profile.powerUpInventory[powerUp.id] ?? 0;
                const isUnavailable = quantity <= 0 || (powerUp.id === 'souvenir' && souvenirBonusActive);
                const isDisabled =
                  isUnavailable ||
                  status !== 'playing' ||
                  isResolving ||
                  aiThinking ||
                  !isPlayerTurn ||
                  goldenPassportActive ||
                  flippedIds.length > 0;
                const showInfo = activePowerUpInfo === powerUp.id;

                return (
                  <div
                    className={`power-up-card${isUnavailable ? ' used' : ''}${showInfo ? ' info-open' : ''}`}
                    key={powerUp.id}
                  >
                    <button
                      className="power-up-use-button"
                      disabled={isDisabled}
                      onClick={() => {
                        setActivePowerUpInfo(null);
                        handlePowerUp(powerUp);
                      }}
                      type="button"
                    >
                      <span className="power-up-icon">
                        <img
                          alt=""
                          className="asset-power-up-icon"
                          onLoad={(event) => {
                            const fallbackLabel = event.currentTarget.nextElementSibling;

                            if (fallbackLabel instanceof HTMLElement) {
                              fallbackLabel.style.display = 'none';
                            }
                          }}
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                          src={getPowerUpAssetPath(powerUp.id)}
                        />
                        <span>{powerUp.icon}</span>
                      </span>
                      <span className="power-up-copy">
                        <strong>{powerUp.name}</strong>
                        <small>x{quantity}</small>
                      </span>
                    </button>
                    <button
                      aria-label={`About ${powerUp.name}`}
                      aria-expanded={showInfo}
                      className={showInfo ? 'power-up-info-button active' : 'power-up-info-button'}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActivePowerUpInfo(showInfo ? null : powerUp.id);
                      }}
                      onFocus={() => setActivePowerUpInfo(powerUp.id)}
                      onMouseEnter={() => setActivePowerUpInfo(powerUp.id)}
                      type="button"
                    >
                      i
                    </button>
                  </div>
                );
              })}
            </div>
            {activePowerUpInfo ? (
              <div className="power-up-info-popover" role="status">
                {powerUps
                  .filter((powerUp) => powerUp.id === activePowerUpInfo)
                  .map((powerUp) => (
                    <div key={powerUp.id}>
                      <strong>{powerUp.name}</strong>
                      <span>{powerUp.description}</span>
                      <span>{powerUp.usage}</span>
                    </div>
                  ))}
              </div>
            ) : null}
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
                      <img
                        alt=""
                        className="asset-card-back"
                        onLoad={(event) => {
                          event.currentTarget.closest('.card-back')?.classList.add('has-card-back-image');
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                        src="/assets/cards/card-back.png"
                      />
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
                disabled={status !== 'playing' || isResolving || aiThinking || !isPlayerTurn || card.matched}
                key={card.id}
                onClick={() => handleCardClick(card)}
                type="button"
              >
                <span className="card-inner">
                  <span className="card-face card-back">
                    <img
                      alt=""
                      className="asset-card-back"
                      onLoad={(event) => {
                        event.currentTarget.closest('.card-back')?.classList.add('has-card-back-image');
                      }}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                      src="/assets/cards/card-back.png"
                    />
                    <span className="card-route-mark" />
                  </span>
                  <span className="card-face card-front">
                    <img
                      alt=""
                      className="asset-card-face"
                      onLoad={(event) => {
                        event.currentTarget.closest('.card-front')?.classList.add('has-card-image');
                      }}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                      src={getCardFaceAssetPath(world, card.symbol)}
                    />
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
            <p>
              {isDuelMode
                ? 'This will end the local duel without changing profile stats.'
                : 'This will end the current match as a loss. No XP, coins, or victory achievements will be awarded.'}
            </p>
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
              {isDuelMode && duelOutcome
                ? `Winner: ${duelOutcome === 'player1' ? duelPlayer1Name : duelOutcome === 'player2' ? duelPlayer2Name : 'Draw'}`
                : isAiMode && aiOutcome
                  ? `Winner: ${aiOutcome === 'player' ? 'Player' : aiOutcome === 'ai' ? 'AI' : 'Draw'}`
                  : status === 'won' ? 'Route Complete' : 'Route Failed'}
            </span>
            {status === 'won' && displayedRewards.leveledUp ? <span className="badge timer-badge level-up-badge">Level Up</span> : null}
            <h2>
              {isDuelMode && duelOutcome
                ? duelOutcome === 'draw'
                  ? 'Draw'
                  : `${duelOutcome === 'player1' ? duelPlayer1Name : duelPlayer2Name} Wins`
                : isAiMode && aiOutcome
                ? aiOutcome === 'ai'
                  ? 'AI Wins'
                  : aiOutcome === 'draw'
                    ? 'Draw'
                    : 'Victory!'
                : status === 'won'
                  ? 'Victory!'
                  : isTimeAttack
                    ? 'Time Up'
                    : isSurvival
                      ? 'No Moves Left'
                      : 'Match Ended'}
            </h2>
            <p>
              {isDuelMode
                ? 'Local duel complete. No XP, coins, or profile stats were changed.'
                : isAiMode && aiOutcome
                ? aiOutcome === 'ai'
                  ? 'The AI claimed more pairs. This counts as a loss with no XP or coins.'
                  : `You ${aiOutcome === 'draw' ? 'matched the AI' : 'beat the AI'} in ${world.name}.`
                : status === 'won'
                ? `You completed ${world.name} in ${mode.name}.`
                : 'Restart the route or return to modes to try a different rule set.'}
            </p>
            {dailyChallengeReward ? (
              <div className="daily-complete-message">
                {dailyChallengeReward.dailyMissionsCompleted.length > 0 ? (
                  <span>
                    Daily Mission Completed: {dailyChallengeReward.dailyMissionsCompleted.map((mission) => mission.title).join(', ')}
                  </span>
                ) : null}
                {dailyChallengeReward.dailyChestUnlocked ? <span>Daily Chest Unlocked</span> : null}
                {dailyChallengeReward.weeklyChallengeCompleted ? <span>Weekly Challenge Completed</span> : null}
                <strong>
                  +{dailyChallengeReward.rewardXp} XP and +{dailyChallengeReward.rewardCoins} coins
                </strong>
              </div>
            ) : null}
            <div className="victory-stats">
              {isDuelMode ? <span><strong>{duelPlayer1Pairs}</strong> {duelPlayer1Name} Pairs</span> : null}
              {isDuelMode ? <span><strong>{duelPlayer2Pairs}</strong> {duelPlayer2Name} Pairs</span> : null}
              {isDuelMode ? <span><strong>{duelOutcome === 'player1' ? duelPlayer1Name : duelOutcome === 'player2' ? duelPlayer2Name : 'Draw'}</strong> Winner</span> : null}
              {isAiMode ? <span><strong>{playerPairs}</strong> Player Pairs</span> : null}
              {isAiMode ? <span><strong>{aiPairs}</strong> AI Pairs</span> : null}
              {isAiMode ? <span><strong>{aiOutcome === 'player' ? 'Player' : aiOutcome === 'ai' ? 'AI' : 'Draw'}</strong> Winner</span> : null}
              <span><strong>{score}</strong> Score</span>
              <span><strong>{moves}</strong> Moves</span>
              <span><strong>{bestCombo}x</strong> Best Combo</span>
              <span><strong>{formatDuration(elapsedSeconds)}</strong> Time</span>
              <span><strong>{status === 'won' && !isDuelMode ? displayedRewards.earnedXp : 0}</strong> XP</span>
              <span><strong>{status === 'won' && !isDuelMode ? displayedRewards.earnedCoins : 0}</strong> Coins</span>
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
