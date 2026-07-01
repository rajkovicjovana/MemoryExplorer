import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Achievement, GameMode, PlayerProfile, PowerUpId, ScreenId, World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { QuestionsModeSession } from './QuestionsModeSession';
import { useLanguage } from '../i18n/useLanguage';
import type {
  AchievementProgress,
  DailyChallengeGameResult,
  DailyChallengeUpdate,
  LevelReward,
  ProgressUpdate,
  ShopActionResult,
  VictoryProgress,
} from '../utils/progression';
import { playSound } from '../utils/audio';
import { formatDuration } from '../utils/progression';

type MemoryCard = {
  id: string;
  pairId: string;
  symbol: string;
  label: string;
  matched: boolean;
};

type BoardImageStatus = 'loading' | 'loaded' | 'failed';

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
  onRegisterExitHandler: (handler: ((screen: ScreenId) => void) | null) => void;
  onUsePowerUp: (powerUpId: PowerUpId) => ShopActionResult;
  onVictory: (victory: VictoryProgress) => ProgressUpdate;
  onWorldModeComplete: (worldId: string, modeId: string) => void;
};

type VictoryRewards = {
  earnedCoins: number;
  earnedXp: number;
  leveledUp: boolean;
  previousLevel?: number;
  nextLevel?: number;
  levelRewards: LevelReward[];
  unlockedWorlds: World[];
};

type AiMemoryEntry = Pick<MemoryCard, 'pairId' | 'symbol' | 'label'>;

const matchResolveDelayMs = 260;
const mismatchDelayMs = 780;
const souvenirScoreBonus = 250;
const souvenirCoinBonus = 120;

type RewardToast = {
  id: string;
  title: string;
  detail: string;
  reward: string;
  kind: 'badge' | 'daily' | 'chest' | 'weekly';
};

const rewardToastIcons: Record<RewardToast['kind'], string> = {
  badge: 'T',
  daily: 'D',
  chest: 'C',
  weekly: 'W',
};

function getLiveComboAchievementIds(comboCount: number): string[] {
  const achievementIds: string[] = [];

  if (comboCount >= 5) {
    achievementIds.push('combo-legend-bronze');
  }

  if (comboCount >= 10) {
    achievementIds.push('combo-legend-silver');
  }

  if (comboCount >= 15) {
    achievementIds.push('combo-legend-gold');
  }

  return achievementIds;
}

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

const mountainCardAssetPaths: Record<string, string> = {
  Peak: '/assets/cards/mountain-1.png',
  Cabin: '/assets/cards/mountain-2.png',
  Compass: '/assets/cards/mountain-3.png',
  Pine: '/assets/cards/mountain-4.png',
  Glacier: '/assets/cards/mountain-5.png',
  Eagle: '/assets/cards/mountain-6.png',
  Campfire: '/assets/cards/mountain-7.png',
  Backpack: '/assets/cards/mountain-8.png',
  Waterfall: '/assets/cards/mountain-9.png',
  'Rope Bridge': '/assets/cards/mountain-10.png',
  Snowboard: '/assets/cards/mountain-11.png',
  Lake: '/assets/cards/mountain-12.png',
  Ibex: '/assets/cards/mountain-13.png',
  Tent: '/assets/cards/mountain-14.png',
  Map: '/assets/cards/mountain-15.png',
  'Hot Spring': '/assets/cards/mountain-16.png',
  'Summit Flag': '/assets/cards/mountain-17.png',
  Lantern: '/assets/cards/mountain-18.png',
};

function getCardFaceAssetPath(world: World, symbol: string): string {
  if (world.id === 'mountains') {
    return mountainCardAssetPaths[symbol] ?? `/assets/cards/mountain-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  }

  const worldAssetId = getWorldAssetId(world.id);
  const symbolAssetId = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `/assets/cards/${worldAssetId}-${symbolAssetId}.png`;
}

function getPowerUpAssetPath(powerUpId: PowerUpId): string {
  return `/assets/icons/powerup-${powerUpId}.png`;
}

function getGameplaySubtitle(mode: GameMode, world: World): string {
  const routeLabel = world.name;

  if (mode.id === 'survival') {
    return `${routeLabel}. Complete the route before you run out of moves.`;
  }

  if (mode.id === 'duel') {
    return `${routeLabel}. Pass the device and outscore your rival.`;
  }

  return routeLabel;
}

const worldBaseXp: Record<string, Record<string, number>> = {
  europe: { classic: 80, 'time-attack': 120, survival: 130, ai: 150 },
  tropics: { classic: 120, 'time-attack': 170, survival: 180, ai: 210 },
  mountains: { classic: 160, 'time-attack': 230, survival: 250, ai: 290 },
  city: { classic: 190, 'time-attack': 280, survival: 300, ai: 350 },
  space: { classic: 240, 'time-attack': 360, survival: 390, ai: 450 },
};

function calculateRewards(
  score: number,
  bestCombo: number,
  hasSouvenirBonus: boolean,
  mode: GameMode,
  world: World,
  elapsedSeconds: number,
  mismatchCount: number,
): Omit<VictoryRewards, 'leveledUp'> {
  if (mode.id === 'zen' || mode.id === 'duel') {
    return {
      earnedXp: 0,
      earnedCoins: 0,
      levelRewards: [],
      unlockedWorlds: [],
    };
  }

  const baseXp = worldBaseXp[world.id]?.[mode.id] ?? 80;
  const comboBonus = Math.min(60, Math.max(0, bestCombo - 2) * 8);
  const speedBonus = elapsedSeconds > 0 && elapsedSeconds <= 90 ? Math.max(0, Math.round((90 - elapsedSeconds) / 3)) : 0;
  const perfectBonus = mismatchCount === 0 ? 35 : 0;

  return {
    earnedXp: baseXp + comboBonus + speedBonus + perfectBonus,
    earnedCoins: Math.max(12, Math.round(score / 45) + bestCombo * 2) + (hasSouvenirBonus ? souvenirCoinBonus : 0),
    levelRewards: [],
    unlockedWorlds: [],
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
  onRegisterExitHandler,
  onUsePowerUp,
  onVictory,
  onWorldModeComplete,
}: GameplayPlaceholderProps) {
  const [restartKey, setRestartKey] = useState(0);

  if (mode.id === 'questions') {
    return (
      <QuestionsModeSession
        key={`${world.id}-${mode.id}-${restartKey}`}
        onNavigate={onNavigate}
        onRegisterExitHandler={onRegisterExitHandler}
        onRestart={() => setRestartKey((currentKey) => currentKey + 1)}
        world={world}
      />
    );
  }

  return (
    <GameplaySession
      key={`${world.id}-${mode.id}-${restartKey}`}
      duelPlayers={duelPlayers}
      mode={mode}
      onAchievementUnlock={onAchievementUnlock}
      onDailyChallengeCheck={onDailyChallengeCheck}
      onLoss={onLoss}
      onNavigate={onNavigate}
      onRegisterExitHandler={onRegisterExitHandler}
      onRestart={() => setRestartKey((currentKey) => currentKey + 1)}
      onUsePowerUp={onUsePowerUp}
      onVictory={onVictory}
      onWorldModeComplete={onWorldModeComplete}
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
  onRegisterExitHandler,
  onRestart,
  onUsePowerUp,
  onVictory,
  onWorldModeComplete,
}: GameplaySessionProps) {
  const { t } = useLanguage();
  const boardConfig = useMemo(() => getBoardConfig(world), [world]);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(world, boardConfig));
  const [cardImageStatus, setCardImageStatus] = useState<Record<string, BoardImageStatus>>({});
  const [selectedCards, setSelectedCards] = useState<MemoryCard[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboBurst, setComboBurst] = useState<number | null>(null);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(boardConfig.timeLimit);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mismatchCount, setMismatchCount] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [victoryRewards, setVictoryRewards] = useState<VictoryRewards | null>(null);
  const [celebrationStep, setCelebrationStep] = useState<'victory' | 'level' | 'world' | 'done'>('victory');
  const [, setNewlyUnlockedAchievements] = useState<Achievement[]>([]);
  const [rewardToasts, setRewardToasts] = useState<RewardToast[]>([]);
  const [pendingLevelRewards, setPendingLevelRewards] = useState<LevelReward[]>([]);
  const [souvenirBonusActive, setSouvenirBonusActive] = useState(false);
  const [powerUpsUsedCount, setPowerUpsUsedCount] = useState(0);
  const [temporaryRevealedIds, setTemporaryRevealedIds] = useState<string[]>([]);
  const [goldenPassportActive, setGoldenPassportActive] = useState(false);
  const [powerUpMessage, setPowerUpMessage] = useState('');
  const [activePowerUpInfo, setActivePowerUpInfo] = useState<PowerUpId | null>(null);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pendingExitScreen, setPendingExitScreen] = useState<ScreenId | null>(null);
  const [currentTurn, setCurrentTurn] = useState<PlayerTurn>('player');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('medium');
  const [aiDifficultyLocked, setAiDifficultyLocked] = useState(false);
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
  const [, setDailyChallengeReward] = useState<DailyChallengeUpdate | null>(null);
  const aiTurnInProgressRef = useRef(false);
  const aiTimersRef = useRef<number[]>([]);
  const gameplayTimersRef = useRef<number[]>([]);
  const selectedCardsRef = useRef<MemoryCard[]>([]);
  const isResolvingRef = useRef(false);
  const powerUpPanelRef = useRef<HTMLDivElement | null>(null);
  const lastStatusSoundRef = useRef<GameStatus>('playing');
  const lastCelebrationSoundRef = useRef<typeof celebrationStep>('victory');

  const pairCount = cards.length / 2;
  const isAiMode = mode.id === 'ai';
  const isDuelMode = mode.id === 'duel';
  const isTimeAttack = mode.id === 'time-attack';
  const isSurvival = mode.id === 'survival';
  const isZen = mode.id === 'zen';
  const remainingMoves = Math.max(0, boardConfig.survivalMaxMoves - moves);
  const hasSouvenirBonus = souvenirBonusActive;
  const displayedRewards = victoryRewards ?? {
    ...calculateRewards(score, bestCombo, hasSouvenirBonus, mode, world, elapsedSeconds, mismatchCount),
    levelRewards: [],
    leveledUp: false,
  };
  const powerUpsEnabled = !isZen && !isDuelMode;
  const isPlayerTurn = !isAiMode || currentTurn === 'player';
  const canChangeAiDifficulty = isAiMode && status === 'playing' && !aiDifficultyLocked && !isResolving && !aiThinking;
  const duelPlayer1Name = duelPlayers.player1.trim() || 'Player 1';
  const duelPlayer2Name = duelPlayers.player2.trim() || 'Player 2';
  const showRewardToasts = rewardToasts.length > 0 && !(status === 'won' && (celebrationStep === 'level' || celebrationStep === 'world'));
  const currentDuelPlayerName = duelTurn === 'player1' ? duelPlayer1Name : duelPlayer2Name;

  const cardFaceUrls = useMemo(
    () => {
      const boardPairCount = (boardConfig.columns * boardConfig.rows) / 2;
      const boardSymbols = Array.from(
        { length: boardPairCount },
        (_, index) => world.sampleCardSymbols[index % world.sampleCardSymbols.length],
      );

      return Array.from(new Set(boardSymbols.map((symbol) => getCardFaceAssetPath(world, symbol))));
    },
    [boardConfig.columns, boardConfig.rows, world],
  );
  const cardFaceUrlKey = cardFaceUrls.join('|');

  useEffect(() => {
    let cancelled = false;

    const preloadTimerId = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (cardFaceUrls.length === 0) {
        setCardImageStatus({});
        return;
      }

      setCardImageStatus(Object.fromEntries(cardFaceUrls.map((url) => [url, 'loading' as BoardImageStatus])));

      cardFaceUrls.forEach((url) => {
        const image = new Image();

        const markSettled = (status: BoardImageStatus) => {
          if (cancelled) {
            return;
          }

          setCardImageStatus((currentStatus) => ({
            ...currentStatus,
            [url]: status,
          }));
        };

        image.onload = () => markSettled('loaded');
        image.onerror = () => markSettled('failed');
        image.src = url;
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(preloadTimerId);
    };
  }, [cardFaceUrlKey, cardFaceUrls]);

  useEffect(() => {
    selectedCardsRef.current = selectedCards;
  }, [selectedCards]);

  useEffect(() => {
    isResolvingRef.current = isResolving;
  }, [isResolving]);

  const scheduleGameplayTimer = useCallback((callback: () => void, delayMs: number) => {
    const timerId = window.setTimeout(() => {
      gameplayTimersRef.current = gameplayTimersRef.current.filter((currentTimerId) => currentTimerId !== timerId);
      callback();
    }, delayMs);

    gameplayTimersRef.current.push(timerId);
  }, []);

  const scheduleAfterNextPaint = useCallback((callback: () => void, delayMs: number) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scheduleGameplayTimer(callback, delayMs);
      });
    });
  }, [scheduleGameplayTimer]);

  const isCardVisible = useCallback((card: MemoryCard) => (
    card.matched || selectedCards.some((selectedCard) => selectedCard.id === card.id) || temporaryRevealedIds.includes(card.id)
  ), [selectedCards, temporaryRevealedIds]);

  const showComboBurst = useCallback((nextCombo: number) => {
    if (nextCombo < 2) {
      return;
    }

    setComboBurst(nextCombo);
    if ([3, 5, 7, 10].includes(nextCombo)) {
      playSound('combo', 0.7);
    }
    scheduleGameplayTimer(() => setComboBurst(null), 1000);
  }, [scheduleGameplayTimer]);

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

    // Future sound hook: trigger badge reward sound here.
    playSound('badge-unlocked', 0.78);
    setRewardToasts((currentToasts) => [
      ...currentToasts,
      ...nextAchievements.map((achievement) => ({
        detail: t(`achievementsList.${achievement.id}.title`),
        id: `badge-${achievement.id}-${Date.now()}`,
        kind: 'badge' as const,
        reward: `+${achievement.reward} ${t('common.xp')}`,
        title: t('toasts.badgeUnlocked'),
      })),
    ]);
    setNewlyUnlockedAchievements((currentAchievements) => {
      const currentIds = new Set(currentAchievements.map((achievement) => achievement.id));
      const uniqueNextAchievements = nextAchievements.filter((achievement) => !currentIds.has(achievement.id));

      return [...currentAchievements, ...uniqueNextAchievements];
    });
    window.setTimeout(() => {
      setNewlyUnlockedAchievements([]);
      setRewardToasts([]);
    }, 3200);
  }, [t]);

  const showPowerUpMessage = (message: string) => {
    setPowerUpMessage(message);
    window.setTimeout(() => setPowerUpMessage(''), 2200);
  };

  const rememberLevelRewards = useCallback((nextLevelRewards: LevelReward[]) => {
    if (nextLevelRewards.length === 0) {
      return;
    }

    setPendingLevelRewards((currentRewards) => [
      ...currentRewards,
      ...nextLevelRewards.filter(
        (nextReward) => !currentRewards.some((currentReward) => currentReward.level === nextReward.level),
      ),
    ]);
  }, []);

  const handleGameplayAchievementUnlocks = useCallback((achievementIds: string[]) => {
    const achievementUpdate = onAchievementUnlock(achievementIds);

    rememberLevelRewards(achievementUpdate.levelRewards);
    showAchievementUnlocks(achievementUpdate.newlyUnlockedAchievements);
  }, [onAchievementUnlock, rememberLevelRewards, showAchievementUnlocks]);

  const checkDailyChallenge = useCallback((result: DailyChallengeGameResult, options?: { showInResult?: boolean }) => {
    const update = onDailyChallengeCheck(result);

    if (update.dailyMissionsCompleted.length > 0 || update.dailyChestUnlocked || update.weeklyChallengeCompleted) {
      if (options?.showInResult !== false) {
        setDailyChallengeReward(update);
      }

      if (update.leveledUp || update.unlockedWorlds.length > 0) {
        setVictoryRewards((currentRewards) => currentRewards
          ? {
              ...currentRewards,
              leveledUp: currentRewards.leveledUp || update.leveledUp,
              nextLevel: Math.max(currentRewards.nextLevel ?? update.nextLevel, update.nextLevel),
              previousLevel: currentRewards.previousLevel ?? update.previousLevel,
              levelRewards: [
                ...currentRewards.levelRewards,
                ...update.levelRewards.filter(
                  (nextReward) => !currentRewards.levelRewards.some((currentReward) => currentReward.level === nextReward.level),
                ),
              ],
              unlockedWorlds: [
                ...currentRewards.unlockedWorlds,
                ...update.unlockedWorlds.filter(
                  (nextWorld) => !currentRewards.unlockedWorlds.some((currentWorld) => currentWorld.id === nextWorld.id),
                ),
              ],
            }
          : currentRewards);
      }
      if (update.weeklyChallengeCompleted) {
        playSound('badge-unlocked', 0.74);
      } else {
        playSound('daily-complete', 0.72);
      }
      setRewardToasts((currentToasts) => [
        ...currentToasts,
        ...update.dailyMissionsCompleted.map((mission) => ({
          detail: t(`dailyMissions.${mission.type}.title`),
          id: `daily-${mission.id}-${Date.now()}`,
          kind: 'daily' as const,
          reward: `+${mission.rewardXp} ${t('common.xp')} +${mission.rewardCoins} ${t('common.coins')}`,
          title: t('toasts.dailyMissionComplete'),
        })),
        ...(update.dailyChestUnlocked
          ? [{
              detail: t('daily.dailyChest'),
              id: `daily-chest-${Date.now()}`,
              kind: 'chest' as const,
              reward: `+${update.rewardXp} ${t('common.xp')} +${update.rewardCoins} ${t('common.coins')}`,
              title: t('toasts.dailyChestUnlocked'),
            }]
          : []),
        ...(update.weeklyChallengeCompleted
          ? [{
              detail: t('daily.weeklyChallenge'),
              id: `weekly-${Date.now()}`,
              kind: 'weekly' as const,
              reward: `+${update.rewardXp} ${t('common.xp')} +${update.rewardCoins} ${t('common.coins')}`,
              title: t('toasts.weeklyChallengeComplete'),
            }]
          : []),
      ]);
      window.setTimeout(() => setRewardToasts([]), 3600);
    }

    if (update.newlyUnlockedAchievements.length > 0) {
      showAchievementUnlocks(update.newlyUnlockedAchievements);
    }
    rememberLevelRewards(update.levelRewards);
  }, [onDailyChallengeCheck, rememberLevelRewards, showAchievementUnlocks, t]);

  const checkLiveRewards = useCallback((nextBestCombo: number, nextPowerUpsUsed: number) => {
    if (isDuelMode || isZen) {
      return;
    }

    checkDailyChallenge({
      aiDifficulty: isAiMode ? aiDifficulty : undefined,
      aiOutcome: isAiMode ? aiOutcome ?? undefined : undefined,
      bestCombo: nextBestCombo,
      elapsedSeconds,
      live: true,
      mismatchCount,
      modeId: mode.id,
      powerUpsUsed: nextPowerUpsUsed,
      score: 0,
      won: false,
    }, { showInResult: false });
  }, [aiDifficulty, aiOutcome, checkDailyChallenge, elapsedSeconds, isAiMode, isDuelMode, isZen, mismatchCount, mode.id]);

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

    const nextPowerUpsUsed = powerUpsUsedCount + 1;
    setPowerUpsUsedCount(nextPowerUpsUsed);
    checkLiveRewards(bestCombo, nextPowerUpsUsed);
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
    onWorldModeComplete(world.id, mode.id);
    setCelebrationStep('victory');
    setStatus('won');
  }, [mode.id, onWorldModeComplete, world.id]);

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
      setCelebrationStep('done');
      setStatus('lost');
      return;
    }

    const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);
    const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus, mode, world, elapsedSeconds, finalMismatchCount);
    const progressUpdate = onVictory({
      ...rewards,
      bestCombo: finalBestCombo,
      elapsedSeconds,
      mismatchCount: finalMismatchCount,
      modeId: mode.id,
      worldId: world.id,
    });

    setScore(finalVictoryScore);
    const combinedLevelRewards = [
      ...pendingLevelRewards,
      ...progressUpdate.levelRewards.filter(
        (nextReward) => !pendingLevelRewards.some((currentReward) => currentReward.level === nextReward.level),
      ),
    ];
    setVictoryRewards({
      ...rewards,
      leveledUp: progressUpdate.leveledUp || combinedLevelRewards.length > 0,
      nextLevel: progressUpdate.nextLevel,
      previousLevel: progressUpdate.previousLevel,
      levelRewards: combinedLevelRewards,
      unlockedWorlds: progressUpdate.unlockedWorlds,
    });
    showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
    completeGame(true, {
      aiOutcome: outcome,
      bestCombo: finalBestCombo,
      mismatchCount: finalMismatchCount,
      score: finalVictoryScore,
    });
    setCelebrationStep('victory');
    setStatus('won');
  }, [completeGame, elapsedSeconds, hasSouvenirBonus, mode, onLoss, onVictory, pendingLevelRewards, showAchievementUnlocks, world]);

  const finishSoloVictory = useCallback((finalScore: number, finalBestCombo: number, finalMismatchCount: number) => {
    const finalVictoryScore = finalScore + (hasSouvenirBonus ? souvenirScoreBonus : 0);

    if (isZen) {
      setScore(finalScore);
      setVictoryRewards({
        earnedCoins: 0,
        earnedXp: 0,
        levelRewards: [],
        leveledUp: false,
        unlockedWorlds: [],
      });
      onWorldModeComplete(world.id, mode.id);
      setCelebrationStep('victory');
      setStatus('won');
      return;
    }

    const rewards = calculateRewards(finalVictoryScore, finalBestCombo, hasSouvenirBonus, mode, world, elapsedSeconds, finalMismatchCount);
    const progressUpdate = onVictory({
      ...rewards,
      bestCombo: finalBestCombo,
      elapsedSeconds,
      mismatchCount: finalMismatchCount,
      modeId: mode.id,
      worldId: world.id,
    });

    setScore(finalVictoryScore);
    const combinedLevelRewards = [
      ...pendingLevelRewards,
      ...progressUpdate.levelRewards.filter(
        (nextReward) => !pendingLevelRewards.some((currentReward) => currentReward.level === nextReward.level),
      ),
    ];
    setVictoryRewards({
      ...rewards,
      leveledUp: progressUpdate.leveledUp || combinedLevelRewards.length > 0,
      nextLevel: progressUpdate.nextLevel,
      previousLevel: progressUpdate.previousLevel,
      levelRewards: combinedLevelRewards,
      unlockedWorlds: progressUpdate.unlockedWorlds,
    });
    showAchievementUnlocks(progressUpdate.newlyUnlockedAchievements);
    completeGame(true, {
      bestCombo: finalBestCombo,
      mismatchCount: finalMismatchCount,
      score: finalVictoryScore,
    });
    setCelebrationStep('victory');
    setStatus('won');
  }, [completeGame, elapsedSeconds, hasSouvenirBonus, isZen, mode, onVictory, onWorldModeComplete, pendingLevelRewards, showAchievementUnlocks, world]);

  const revealTemporarily = (cardIds: string[], durationMs: number) => {
    setTemporaryRevealedIds(cardIds);
    isResolvingRef.current = true;
    setIsResolving(true);
    scheduleGameplayTimer(() => {
      setTemporaryRevealedIds([]);
      isResolvingRef.current = false;
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
      isPaused ||
      !isPlayerTurn ||
      isResolving ||
      goldenPassportActive ||
      selectedCards.length > 0 ||
      (powerUp.id === 'souvenir' && souvenirBonusActive)
    ) {
      return;
    }

    if ((profile.powerUpInventory[powerUp.id] ?? 0) <= 0) {
      showPowerUpMessage(`${t(`shopItems.${powerUp.id}.name`)}: ${t('common.shop')}`);
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
      setSelectedCards([]);
      showPowerUpMessage('Golden Passport is ready. Pick any hidden card.');
      return;
    }

    if (powerUp.id === 'shuffle') {
      const eligibleCards = cards.filter(
        (card) =>
          !card.matched &&
          !selectedCards.some((selectedCard) => selectedCard.id === card.id) &&
          !temporaryRevealedIds.includes(card.id),
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
          if (
            !card ||
            card.matched ||
            selectedCards.some((selectedCard) => selectedCard.id === card.id) ||
            temporaryRevealedIds.includes(card.id)
          ) {
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
    showPowerUpMessage(`${t('shopItems.souvenir.name')} ${t('common.claimed')}.`);
  };

  useEffect(() => {
    if (status !== 'playing' || isPaused) {
      return;
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((currentSeconds) => currentSeconds + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isPaused, status]);

  useEffect(() => {
    if (!isTimeAttack || status !== 'playing' || isPaused) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((currentTime) => {
        if (currentTime <= 1) {
          completeGame(false);
          setCelebrationStep('done');
          setStatus('lost');
          return 0;
        }

        return currentTime - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [completeGame, isPaused, isTimeAttack, status]);

  const handleCardClick = (card: MemoryCard) => {
    if (card.matched) {
      return;
    }

    if (
      status !== 'playing' ||
      isPaused ||
      isResolvingRef.current ||
      aiThinking ||
      !isPlayerTurn ||
      selectedCardsRef.current.some((selectedCard) => selectedCard.id === card.id) ||
      selectedCardsRef.current.length >= 2
    ) {
      return;
    }

    rememberSeenCards([card]);
    if (isAiMode) {
      setAiDifficultyLocked(true);
    }

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
      selectedCardsRef.current = [card, matchingCard];
      setSelectedCards([card, matchingCard]);
      setMoves(nextMoveCount);
      isResolvingRef.current = true;
      setIsResolving(true);

      scheduleAfterNextPaint(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === card.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setPlayerPairs(nextPlayerPairs);
        setDuelPlayer1Pairs(nextDuelPlayer1Pairs);
        setDuelPlayer2Pairs(nextDuelPlayer2Pairs);
        setScore(finalScore);
        setCombo(nextCombo);
        showComboBurst(nextCombo);
        setBestCombo(finalBestCombo);
        selectedCardsRef.current = [];
        setSelectedCards([]);
        isResolvingRef.current = false;
        setIsResolving(false);
        playSound('card-match', 0.72);
        showPowerUpMessage('Golden Passport completed a pair.');
        if (isDuelMode) {
          setDuelMessage(`${currentDuelPlayerName} found a pair and goes again.`);
        }

        const gameplayAchievementIds = getLiveComboAchievementIds(nextCombo);

        if (!isDuelMode) {
          handleGameplayAchievementUnlocks(gameplayAchievementIds);
          checkLiveRewards(finalBestCombo, powerUpsUsedCount);
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
          setCelebrationStep('done');
          setStatus('lost');
        }
      }, matchResolveDelayMs);

      return;
    }

    if (selectedCardsRef.current.length === 0) {
      selectedCardsRef.current = [card];
      setSelectedCards([card]);
      return;
    }

    const [firstSelectedCard] = selectedCardsRef.current;
    const nextSelectedCards = [firstSelectedCard, card].filter((selectedCard): selectedCard is MemoryCard => Boolean(selectedCard));
    selectedCardsRef.current = nextSelectedCards;
    setSelectedCards(nextSelectedCards);

    const nextMoveCount = moves + 1;
    setMoves(nextMoveCount);
    isResolvingRef.current = true;
    setIsResolving(true);

    const [firstCard, secondCard] = nextSelectedCards;

    if (!firstCard || !secondCard) {
      selectedCardsRef.current = [];
      setSelectedCards([]);
      isResolvingRef.current = false;
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

      scheduleAfterNextPaint(() => {
        setCards((currentCards) =>
          currentCards.map((item) => (item.pairId === firstCard.pairId ? { ...item, matched: true } : item)),
        );
        setMatches(nextMatches);
        setPlayerPairs(nextPlayerPairs);
        setDuelPlayer1Pairs(nextDuelPlayer1Pairs);
        setDuelPlayer2Pairs(nextDuelPlayer2Pairs);
        setScore((currentScore) => currentScore + matchScore);
        setCombo(nextCombo);
        showComboBurst(nextCombo);
        setBestCombo(finalBestCombo);
        selectedCardsRef.current = [];
        setSelectedCards([]);
        isResolvingRef.current = false;
        setIsResolving(false);
        playSound('card-match', 0.72);
        if (isDuelMode) {
          setDuelMessage(`${currentDuelPlayerName} found a pair and goes again.`);
        }

        const gameplayAchievementIds = getLiveComboAchievementIds(nextCombo);

        if (!isDuelMode) {
          handleGameplayAchievementUnlocks(gameplayAchievementIds);
          checkLiveRewards(finalBestCombo, powerUpsUsedCount);
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
          setCelebrationStep('done');
          setStatus('lost');
        }
      }, matchResolveDelayMs);

      return;
    }

    scheduleAfterNextPaint(() => {
      setCombo(0);
      setMismatchCount((currentMismatchCount) => currentMismatchCount + 1);

      if (!isZen) {
        setScore((currentScore) => Math.max(0, currentScore - 25));
      }

      if (isSurvival && nextMoveCount >= boardConfig.survivalMaxMoves) {
        completeGame(false, {
          mismatchCount: mismatchCount + 1,
        });
        setCelebrationStep('done');
        setStatus('lost');
      }

      selectedCardsRef.current = [];
      setSelectedCards([]);
      if (isDuelMode) {
        const nextTurn: DuelTurn = duelTurn === 'player1' ? 'player2' : 'player1';
        const nextPlayerName = nextTurn === 'player1' ? duelPlayer1Name : duelPlayer2Name;

        setDuelTurn(nextTurn);
        setDuelMessage(`No match. ${nextPlayerName}'s turn.`);
      } else if (isAiMode) {
        setCurrentTurn('ai');
      }
      isResolvingRef.current = false;
      setIsResolving(false);
    }, mismatchDelayMs);
  };

  useEffect(() => {
    return () => {
      aiTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      aiTimersRef.current = [];
      gameplayTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      gameplayTimersRef.current = [];
    };
  }, []);

  const requestGameplayExit = useCallback((screen: ScreenId) => {
    if (status !== 'playing') {
      onNavigate(screen);
      return;
    }

    setPendingExitScreen(screen);
    setShowGiveUpConfirm(true);
  }, [onNavigate, status]);

  useEffect(() => {
    if (status !== 'playing') {
      onRegisterExitHandler(null);
      return undefined;
    }

    onRegisterExitHandler(requestGameplayExit);

    return () => onRegisterExitHandler(null);
  }, [onRegisterExitHandler, requestGameplayExit, status]);

  useEffect(() => {
    if (
      !isAiMode ||
      status !== 'playing' ||
      isPaused ||
      currentTurn !== 'ai' ||
      isResolving ||
      selectedCards.length > 0 ||
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
      selectedCardsRef.current = [firstCard];
      setSelectedCards([firstCard]);
      rememberSeenCards([firstCard]);

      const secondFlipTimer = window.setTimeout(() => {
        const turnSnapshot = latestAiStateRef.current;
        const nextMoveCount = turnSnapshot.moves + 1;
        const nextSelectedCards = [firstCard, secondCard];

        selectedCardsRef.current = nextSelectedCards;
        setSelectedCards(nextSelectedCards);
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
            selectedCardsRef.current = [];
            setSelectedCards([]);
            setIsResolving(false);
            aiTurnInProgressRef.current = false;
            playSound('card-match', 0.66);

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
          selectedCardsRef.current = [];
          setSelectedCards([]);
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
    isAiMode,
    isPaused,
    isResolving,
    pairCount,
    rememberSeenCards,
    selectedCards.length,
    status,
  ]);

  const closeExitConfirm = () => {
    setShowGiveUpConfirm(false);
    setPendingExitScreen(null);
  };

  const confirmGiveUp = () => {
    const exitScreen = pendingExitScreen;

    setShowGiveUpConfirm(false);
    setPendingExitScreen(null);

    if (status !== 'playing') {
      if (exitScreen) {
        onNavigate(exitScreen);
      }

      return;
    }

    setGoldenPassportActive(false);
    setTemporaryRevealedIds([]);
    selectedCardsRef.current = [];
    setSelectedCards([]);
    isResolvingRef.current = false;
    setIsResolving(false);
    if (isDuelMode) {
      setDuelOutcome('draw');
      setCelebrationStep('done');
      setStatus('lost');
      if (exitScreen) {
        onNavigate(exitScreen);
      }
      return;
    }

    onLoss();
    completeGame(false);
    setCelebrationStep('done');
    setStatus('lost');

    if (exitScreen) {
      onNavigate(exitScreen);
    }
  };

  const getNextCelebrationStep = useCallback((currentStep: typeof celebrationStep): typeof celebrationStep => {
    if (currentStep === 'victory') {
      return displayedRewards.leveledUp ? 'level' : displayedRewards.unlockedWorlds.length > 0 ? 'world' : 'done';
    }

    if (currentStep === 'level') {
      return displayedRewards.unlockedWorlds.length > 0 ? 'world' : 'done';
    }

    return 'done';
  }, [displayedRewards.leveledUp, displayedRewards.unlockedWorlds.length]);

  const advanceCelebration = useCallback(() => {
    if (status !== 'won') {
      return;
    }

    setCelebrationStep((currentStep) => getNextCelebrationStep(currentStep));
  }, [getNextCelebrationStep, status]);

  useEffect(() => {
    if (status !== 'won' || celebrationStep !== 'victory') {
      return undefined;
    }

    const timerId = window.setTimeout(advanceCelebration, 3000);

    return () => window.clearTimeout(timerId);
  }, [advanceCelebration, celebrationStep, status]);

  useEffect(() => {
    if (status === 'playing') {
      return;
    }

    document.querySelector('.screen-stack')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [celebrationStep, status]);

  useEffect(() => {
    if (lastStatusSoundRef.current === status) {
      return;
    }

    lastStatusSoundRef.current = status;

    if (status === 'won') {
      playSound('victory', 0.76);
    } else if (status === 'lost') {
      playSound('defeat', 0.76);
    }
  }, [displayedRewards.earnedCoins, status]);

  useEffect(() => {
    if (lastCelebrationSoundRef.current === celebrationStep) {
      return;
    }

    lastCelebrationSoundRef.current = celebrationStep;

    if (celebrationStep === 'level') {
      playSound('level-up', 0.82);
    } else if (celebrationStep === 'world') {
      playSound('world-unlocked', 0.82);
    }
  }, [celebrationStep]);

  const boardStyle = {
    '--board-columns': boardConfig.columns,
    '--world-primary': world.theme.primary,
    '--world-secondary': world.theme.secondary,
    '--world-accent': world.theme.accent,
  } as CSSProperties;

  return (
    <section className="screen gameplay-screen">
      <ScreenHeader
        title={t(`modes.${mode.id}.name`)}
        subtitle={getGameplaySubtitle(mode, { ...world, name: t(`worlds.${world.id}.name`) })}
        action={<button className="small-button" onClick={() => requestGameplayExit('mode-select')} type="button">{t('common.modes')}</button>}
      />

      <div className="gameplay-shell" style={boardStyle}>
        <div className="game-status-ribbon">
          <span className="badge destination-badge">{t(`difficulties.${world.difficulty}`)}</span>
          <span className="badge">{t(`modes.${mode.id}.name`)}</span>
          {isAiMode ? <span className="badge timer-badge">{currentTurn === 'player' ? t('common.playerTurn') : `${t('common.ai')} Turn`}</span> : null}
          {isDuelMode ? <span className="badge timer-badge">{currentDuelPlayerName}'s Turn</span> : null}
          {isSurvival ? <span className="badge danger-badge">{remainingMoves} {t('common.moves')}</span> : null}
          {isTimeAttack ? <span className="badge timer-badge">{formatTime(timeLeft)}</span> : null}
        </div>

        {isAiMode ? (
          <div className="ai-duel-panel">
            <div>
              <span className="eyebrow">{t('gameplay.aiDifficulty')}</span>
              <div className="ai-difficulty-selector" role="group" aria-label={t('gameplay.aiDifficulty')}>
                {(['easy', 'medium', 'hard'] as AiDifficulty[]).map((difficulty) => (
                  <button
                    className={aiDifficulty === difficulty ? 'selected' : ''}
                    disabled={!canChangeAiDifficulty}
                    key={difficulty}
                    onClick={() => {
                      if (canChangeAiDifficulty) {
                        setAiDifficulty(difficulty);
                      }
                    }}
                    type="button"
                  >
                    {difficulty}
                  </button>
                ))}
              </div>
            </div>
            <div className="turn-indicator" aria-live="polite">
              <span className="eyebrow">{t('gameplay.currentTurn')}</span>
              <strong>{aiThinking ? t('gameplay.aiThinking') : currentTurn === 'player' ? t('common.player') : t('common.ai')}</strong>
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
          {isTimeAttack ? <span><strong>{formatTime(timeLeft)}</strong> {t('common.timer')}</span> : null}
          <span><strong>{moves}</strong> {t('common.moves')}</span>
          <span><strong>{score}</strong> {t('common.score')}</span>
        </div>

        {comboBurst ? (
          <div className="combo-burst" key={comboBurst} aria-live="polite">
            COMBO x{comboBurst}
          </div>
        ) : null}

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
              <span className="eyebrow">{t('gameplay.powerUpsHeader')}</span>
              <strong>{goldenPassportActive ? t('gameplay.goldenPassportActive') : t('gameplay.oncePerGame')}</strong>
            </div>
            <div className="power-up-bar">
              {powerUps.map((powerUp) => {
                const quantity = profile.powerUpInventory[powerUp.id] ?? 0;
                const isUnavailable = quantity <= 0 || (powerUp.id === 'souvenir' && souvenirBonusActive);
                const isDisabled =
                  isUnavailable ||
                  status !== 'playing' ||
                  isPaused ||
                  isResolving ||
                  aiThinking ||
                  !isPlayerTurn ||
                  goldenPassportActive ||
                  selectedCards.length > 0;
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
                          decoding="async"
                          loading="lazy"
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
                        <strong>{t(`shopItems.${powerUp.id}.name`)}</strong>
                        <small>x{quantity}</small>
                      </span>
                    </button>
                    <button
                      aria-label={`About ${t(`shopItems.${powerUp.id}.name`)}`}
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
                      <strong>{t(`shopItems.${powerUp.id}.name`)}</strong>
                      <span>{t(`shopItems.${powerUp.id}.description`)}</span>
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
                  aria-label={t('gameplay.invalidCard')}
                  className="memory-card playable card-invalid"
                  disabled
                  key={`invalid-card-${index}`}
                  type="button"
                >
                  <span className="card-inner">
                    <span className="card-face card-back" />
                  </span>
                </button>
              );
            }

            const isVisible = isCardVisible(card);
            const cardFaceUrl = getCardFaceAssetPath(world, card.symbol);
            const isCardImageLoaded = cardImageStatus[cardFaceUrl] === 'loaded';
            const isCardLocked = status !== 'playing' || isPaused || isResolving || aiThinking || !isPlayerTurn || card.matched;
            const cardStateClass = [
              'memory-card playable',
              isVisible ? 'flipped' : '',
              card.matched ? 'matched' : '',
              isCardLocked ? 'locked' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                aria-label={t('gameplay.memoryCard', { label: isVisible ? card.symbol : t('gameplay.hiddenCard') })}
                aria-disabled={isCardLocked}
                className={cardStateClass}
                disabled={isCardLocked}
                key={card.id}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                  }

                  event.preventDefault();

                  if (!isCardLocked) {
                    handleCardClick(card);
                  }
                }}
                onPointerUp={() => {
                  if (!isCardLocked) {
                    handleCardClick(card);
                  }
                }}
                type="button"
              >
                <span className="card-inner">
                  {isVisible ? (
                    <span className={isCardImageLoaded ? 'card-face card-front image-loaded' : 'card-face card-front'}>
                    {isVisible && isCardImageLoaded ? (
                      <img
                        alt=""
                        className="asset-card-face"
                        decoding="async"
                        draggable={false}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                        src={cardFaceUrl}
                      />
                    ) : null}
                    <strong>{card.label}</strong>
                    <small>{card.symbol}</small>
                    </span>
                  ) : (
                    <span className="card-face card-back" />
                  )}
                </span>
              </button>
            );
            })}
          </div>

        <div className="game-action-row gameplay-controls">
            <button
              className="secondary-button"
              disabled={status !== 'playing'}
              onClick={() => setIsPaused((currentPaused) => !currentPaused)}
              type="button"
            >
              {isPaused ? t('common.resume') : t('common.pause')}
            </button>
            <button
              className="secondary-button danger-action"
              disabled={status !== 'playing'}
              onClick={() => setShowGiveUpConfirm(true)}
              type="button"
            >
              {t('gameplay.giveUp')}
            </button>
            <button className="secondary-button" onClick={() => requestGameplayExit('mode-select')} type="button">{t('common.modes')}</button>
          </div>
      </div>

      {status === 'playing' && isPaused ? (
        <div className="paused-banner" role="status" aria-live="polite">
          <strong>{t('gameplay.paused')}</strong>
          <span>{t('gameplay.pausedText')}</span>
        </div>
      ) : null}

      {showRewardToasts ? (
        <div className={`reward-popup-stack ${status === 'playing' ? '' : 'reward-popup-stack-after-game'}`} aria-live="polite">
          {rewardToasts.slice(-4).map((toast) => (
            <div className={`reward-popup reward-popup-${toast.kind}`} key={toast.id}>
              <span className="reward-toast-icon" aria-hidden="true">{rewardToastIcons[toast.kind]}</span>
              <div>
                <strong>{toast.title}</strong>
                <span>{toast.detail}</span>
                <em>{toast.reward}</em>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showGiveUpConfirm ? (
        <div className="victory-overlay" role="dialog" aria-modal="true" aria-label={t('gameplay.endGameQuestion')}>
          <div className="victory-card confirm-card">
            <span className="badge danger-badge">{t('gameplay.endMatch')}</span>
            <h2>{t('gameplay.endGameQuestion')}</h2>
            <p>{t('gameplay.leavingLoss')}</p>
            <div className="game-action-row">
              <button className="secondary-button" onClick={closeExitConfirm} type="button">
                {t('common.stay')}
              </button>
              <button className="primary-button danger-action" onClick={confirmGiveUp} type="button">
                {t('common.endGame')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {status === 'won' && celebrationStep === 'level' ? (
        <div className="victory-overlay celebration-overlay" onClick={advanceCelebration} role="dialog" aria-modal="true" aria-label={t('gameplay.levelUp')}>
          <div className="celebration-card level-celebration" onClick={(event) => event.stopPropagation()}>
            <span className="celebration-medal" aria-hidden="true">★</span>
            <strong>{t('gameplay.levelUp')}</strong>
            <h2>{t('gameplay.levelReached', { level: displayedRewards.nextLevel ?? profile.level })}</h2>
            <p>{t('gameplay.yourRankIncreased')}</p>
            {displayedRewards.levelRewards.length > 0 ? (
              <div className="level-reward-list" aria-label={t('common.rewards')}>
                <span className="level-reward-heading">{t('common.rewards')}</span>
                {displayedRewards.levelRewards.map((reward) => (
                  <div className="level-reward-bundle" key={reward.level}>
                    <span>+{reward.coins} {t('common.coins')}</span>
                    {reward.powerUps.map((powerUp) => (
                      <span key={`${reward.level}-${powerUp.id}`}>
                        {t(`shopItems.${powerUp.id}.name`)} x{powerUp.quantity}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <small>{t('gameplay.worldReady')}</small>
            )}
            <button className="primary-button wide" onClick={advanceCelebration} type="button">{t('common.continueJourney')}</button>
          </div>
        </div>
      ) : null}

      {status === 'won' && celebrationStep === 'world' ? (
        <div
          className="victory-overlay celebration-overlay world-celebration-overlay"
          onClick={advanceCelebration}
          role="dialog"
          aria-modal="true"
          aria-label={t('gameplay.worldUnlocked')}
          style={displayedRewards.unlockedWorlds[0] ? { '--unlock-world-image': `url("/assets/backgrounds/${getWorldAssetId(displayedRewards.unlockedWorlds[0].id)}.png")` } as CSSProperties : undefined}
        >
          <div className="celebration-card world-celebration" onClick={(event) => event.stopPropagation()}>
            <span className="celebration-medal" aria-hidden="true">✓</span>
            <strong>{t('gameplay.worldUnlocked')}</strong>
            <h2>{displayedRewards.unlockedWorlds.map((nextWorld) => t(`worlds.${nextWorld.id}.name`)).join(', ')}</h2>
            <p>{t('gameplay.worldReady')}</p>
            <button className="primary-button wide" onClick={advanceCelebration} type="button">{t('common.continueJourney')}</button>
          </div>
        </div>
      ) : null}

      {status !== 'playing' && !(status === 'won' && (celebrationStep === 'level' || celebrationStep === 'world')) ? (
        <div
          className="victory-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={status === 'won' ? t('common.victory') : t('gameplay.routeFailed')}
        >
          <div className={`victory-card end-card ${status === 'won' ? 'end-card-win' : 'end-card-loss'}`}>
            {status === 'won' ? (
              <div className="coin-burst" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ) : null}
            <span className={status === 'won' ? 'badge premium-badge' : 'badge danger-badge'}>
              {isDuelMode && duelOutcome
                ? `${t('common.winner')}: ${duelOutcome === 'player1' ? duelPlayer1Name : duelOutcome === 'player2' ? duelPlayer2Name : t('common.draw')}`
                : isAiMode && aiOutcome
                  ? `${t('common.winner')}: ${aiOutcome === 'player' ? t('common.player') : aiOutcome === 'ai' ? t('common.ai') : t('common.draw')}`
                  : status === 'won' ? t('gameplay.routeComplete') : t('gameplay.routeFailed')}
            </span>
            <h2>
              {status === 'lost'
                ? t('common.defeat')
                : isDuelMode && duelOutcome
                ? duelOutcome === 'draw'
                  ? t('common.draw')
                  : `${duelOutcome === 'player1' ? duelPlayer1Name : duelPlayer2Name} ${t('common.wins')}`
                : isAiMode && aiOutcome
                ? aiOutcome === 'ai'
                  ? `${t('common.ai')} ${t('common.wins')}`
                  : aiOutcome === 'draw'
                    ? t('common.draw')
                    : t('common.victory')
                : status === 'won'
                  ? t('common.victory')
                  : isTimeAttack
                    ? t('gameplay.timeUp')
                    : isSurvival
                      ? t('gameplay.noMovesLeft')
                      : 'Match Ended'}
            </h2>
            <p>
              {isDuelMode
                ? `${t(`modes.${mode.id}.name`)} ${t('common.complete')}.`
                : isAiMode && aiOutcome
                ? aiOutcome === 'ai'
                  ? `${t('common.ai')} ${t('common.wins')}.`
                  : `${t('gameplay.routeComplete')}: ${t(`worlds.${world.id}.name`)}.`
                : status === 'won'
                ? `${t('gameplay.routeComplete')}: ${t(`worlds.${world.id}.name`)} - ${t(`modes.${mode.id}.name`)}.`
                : t('gameplay.routeFailedText')}
            </p>
            {status === 'won' && !isDuelMode && (displayedRewards.earnedXp > 0 || displayedRewards.earnedCoins > 0) ? (
              <div className="reward-rain">
                <span>+{displayedRewards.earnedXp} {t('common.xp')}</span>
                <span>+{displayedRewards.earnedCoins} {t('common.coins')}</span>
              </div>
            ) : null}
            <div className="victory-stats">
              {isDuelMode ? <span><strong>{duelPlayer1Pairs}</strong> {duelPlayer1Name} {t('common.pairs')}</span> : null}
              {isDuelMode ? <span><strong>{duelPlayer2Pairs}</strong> {duelPlayer2Name} {t('common.pairs')}</span> : null}
              {isDuelMode ? <span><strong>{duelOutcome === 'player1' ? duelPlayer1Name : duelOutcome === 'player2' ? duelPlayer2Name : t('common.draw')}</strong> {t('common.winner')}</span> : null}
              {isAiMode ? <span><strong>{playerPairs}</strong> {t('common.player')} {t('common.pairs')}</span> : null}
              {isAiMode ? <span><strong>{aiPairs}</strong> {t('common.ai')} {t('common.pairs')}</span> : null}
              {isAiMode ? <span><strong>{aiOutcome === 'player' ? t('common.player') : aiOutcome === 'ai' ? t('common.ai') : t('common.draw')}</strong> {t('common.winner')}</span> : null}
              <span><strong>{score}</strong> {t('common.score')}</span>
              <span><strong>{moves}</strong> {t('common.moves')}</span>
              <span><strong>{bestCombo}x</strong> {t('common.bestCombo')}</span>
              <span><strong>{formatDuration(elapsedSeconds)}</strong> {t('common.time')}</span>
              <span><strong>{status === 'won' && !isDuelMode ? displayedRewards.earnedXp : 0}</strong> {t('common.xp')}</span>
              <span><strong>{status === 'won' && !isDuelMode ? displayedRewards.earnedCoins : 0}</strong> {t('common.coins')}</span>
            </div>
            <div className="game-action-row">
              <button className="secondary-button" onClick={onRestart} type="button">
                {status === 'lost' ? t('common.tryAgain') : t('common.restart')}
              </button>
              <button className="primary-button" onClick={() => onNavigate(status === 'lost' ? 'main-menu' : 'mode-select')} type="button">
                {status === 'lost' ? t('common.home') : t('common.backToModes')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

