import { achievements, dailyMissionTemplates, gameModes, playerProfile, shopItems, weeklyChallengeTemplates, worlds } from '../data/gameData';
import type {
  Achievement,
  DailyMission,
  DailyMissionType,
  DailyMissionsProgress,
  PlayerProfile,
  PowerUpId,
  WeeklyChallenge,
  WeeklyChallengeProgress,
  WeeklyChallengeType,
  World,
} from '../types/game';

const storageKey = 'memory-explorer-progress-v1';

export type VictoryProgress = {
  earnedXp: number;
  earnedCoins: number;
  bestCombo: number;
  elapsedSeconds: number;
  mismatchCount: number;
  modeId?: string;
  worldId?: string;
};

export type ProgressUpdate = {
  newlyUnlockedAchievements: Achievement[];
  profile: PlayerProfile;
  leveledUp: boolean;
  previousLevel: number;
  nextLevel: number;
  levelRewards: LevelReward[];
  unlockedWorlds: World[];
};

export type AchievementProgress = {
  newlyUnlockedAchievements: Achievement[];
  profile: PlayerProfile;
  leveledUp: boolean;
  levelRewards: LevelReward[];
  rewardXp: number;
};

type StoredProfile = Pick<
  PlayerProfile,
  | 'level'
  | 'xp'
  | 'coins'
  | 'totalGames'
  | 'wins'
  | 'losses'
  | 'bestTime'
  | 'bestCombo'
  | 'unlockedAchievements'
  | 'classicWins'
  | 'dailyMissionsCompleted'
  | 'weeklyChallengesCompleted'
  | 'perfectWins'
  | 'highestCombo'
  | 'worldCompletions'
  | 'powerUpInventory'
  | 'claimedLevelRewards'
  | 'dailyMissions'
  | 'weeklyChallenge'
> & {
  dailyChallenge?: unknown;
};

export type ShopActionResult =
  | { ok: true; message: string; profile: PlayerProfile }
  | { ok: false; message: string; profile: PlayerProfile };

export type DailyChallengeGameResult = {
  aiDifficulty?: 'easy' | 'medium' | 'hard';
  aiOutcome?: 'player' | 'ai' | 'draw';
  bestCombo: number;
  elapsedSeconds: number;
  live?: boolean;
  mismatchCount: number;
  modeId: string;
  powerUpsUsed: number;
  score: number;
  won: boolean;
};

export type DailyChallengeUpdate = {
  dailyChestUnlocked: boolean;
  dailyMissionsCompleted: DailyMission[];
  leveledUp: boolean;
  levelRewards: LevelReward[];
  newlyUnlockedAchievements: Achievement[];
  nextLevel: number;
  previousLevel: number;
  profile: PlayerProfile;
  rewardCoins: number;
  rewardXp: number;
  unlockedWorlds: World[];
  weeklyChallengeCompleted: boolean;
};

export type LevelReward = {
  coins: number;
  level: number;
  powerUps: Array<{ id: PowerUpId; quantity: number }>;
};

const worldUnlockLevels: Record<string, number> = {
  europe: 1,
  tropics: 2,
  mountains: 4,
  city: 7,
  space: 10,
};

const achievementDefinitionsById = new Map(achievements.map((achievement) => [achievement.id, achievement]));
const shopItemsById = new Map(shopItems.map((item) => [item.id, item]));
const modeIds = new Set(gameModes.map((mode) => mode.id));
const worldIds = new Set(worlds.map((world) => world.id));

function hydratePowerUpInventory(storedProfile?: Partial<StoredProfile>): PlayerProfile['powerUpInventory'] {
  const powerUpInventory: PlayerProfile['powerUpInventory'] = {};

  Object.entries(storedProfile?.powerUpInventory ?? {}).forEach(([powerUpId, quantity]) => {
    if (!shopItemsById.has(powerUpId as PowerUpId) || typeof quantity !== 'number' || quantity <= 0) {
      return;
    }

    powerUpInventory[powerUpId as PowerUpId] = Math.floor(quantity);
  });

  return powerUpInventory;
}

function hydrateWorldCompletions(storedProfile?: Partial<StoredProfile>): PlayerProfile['worldCompletions'] {
  const worldCompletions: PlayerProfile['worldCompletions'] = {};

  Object.entries(storedProfile?.worldCompletions ?? {}).forEach(([worldId, modes]) => {
    if (!worldIds.has(worldId) || !modes || typeof modes !== 'object') {
      return;
    }

    Object.entries(modes).forEach(([modeId, completed]) => {
      if (!modeIds.has(modeId) || completed !== true) {
        return;
      }

      worldCompletions[worldId] = {
        ...worldCompletions[worldId],
        [modeId]: true,
      };
    });
  });

  return worldCompletions;
}

export function getTodayDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateSeed(dateKey: string): number {
  return dateKey.split('').reduce((seed, character) => seed + character.charCodeAt(0), 0);
}

export function getWeekKey(date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + startOfYear.getDay()) / 7).toString().padStart(2, '0');

  return `${date.getFullYear()}-W${week}`;
}

export function getDailyMissions(dateKey = getTodayDateKey()): DailyMission[] {
  const seed = getDateSeed(dateKey);
  const missions: DailyMission[] = [];
  const usedIndexes = new Set<number>();

  for (let offset = 0; missions.length < 3 && missions.length < dailyMissionTemplates.length; offset += 1) {
    const index = (seed + offset * 3) % dailyMissionTemplates.length;

    if (usedIndexes.has(index)) {
      continue;
    }

    usedIndexes.add(index);
    const template = dailyMissionTemplates[index] ?? dailyMissionTemplates[0];

    missions.push({
      ...template,
      dateKey,
      id: `${dateKey}-${template.type}`,
    });
  }

  return missions;
}

export function getWeeklyChallenge(weekKey = getWeekKey()): WeeklyChallenge {
  const seed = getDateSeed(weekKey);
  const template = weeklyChallengeTemplates[seed % weeklyChallengeTemplates.length] ?? weeklyChallengeTemplates[0];

  return {
    ...template,
    id: `${weekKey}-${template.type}`,
    weekKey,
  };
}

function createDailyMissionsProgress(missions = getDailyMissions()): DailyMissionsProgress {
  return {
    chestRewarded: false,
    dateKey: missions[0]?.dateKey ?? getTodayDateKey(),
    missions: Object.fromEntries(missions.map((mission) => [mission.id, { completed: false, rewarded: false }])),
  };
}

function hydrateDailyMissionsProgress(storedProfile?: Partial<StoredProfile>): DailyMissionsProgress {
  const missions = getDailyMissions();
  const dateKey = missions[0]?.dateKey ?? getTodayDateKey();
  const storedProgress = storedProfile?.dailyMissions;

  if (!storedProgress || storedProgress.dateKey !== dateKey) {
    return createDailyMissionsProgress(missions);
  }

  const nextProgress = createDailyMissionsProgress(missions);

  missions.forEach((mission) => {
    const storedMission = storedProgress.missions[mission.id];

    if (storedMission) {
      nextProgress.missions[mission.id] = {
        completed: Boolean(storedMission.completed),
        rewarded: Boolean(storedMission.rewarded),
      };
    }
  });

  nextProgress.chestRewarded = Boolean(storedProgress.chestRewarded);

  return nextProgress;
}

function createWeeklyChallengeProgress(challenge = getWeeklyChallenge()): WeeklyChallengeProgress {
  return {
    challengeId: challenge.id,
    completed: false,
    progress: 0,
    rewarded: false,
    weekKey: challenge.weekKey,
  };
}

function hydrateWeeklyChallengeProgress(storedProfile?: Partial<StoredProfile>): WeeklyChallengeProgress {
  const challenge = getWeeklyChallenge();
  const storedProgress = storedProfile?.weeklyChallenge;

  if (!storedProgress || storedProgress.weekKey !== challenge.weekKey || storedProgress.challengeId !== challenge.id) {
    return createWeeklyChallengeProgress(challenge);
  }

  return {
    challengeId: challenge.id,
    completed: Boolean(storedProgress.completed),
    progress: Math.max(0, Math.min(challenge.target, storedProgress.progress)),
    rewarded: Boolean(storedProgress.rewarded),
    weekKey: challenge.weekKey,
  };
}

export function getDailyChestProgress(progress: DailyMissionsProgress, missions = getDailyMissions()): number {
  return missions.filter((mission) => progress.missions[mission.id]?.completed).length;
}

function emptyDailyChallengeUpdate(profile: PlayerProfile): DailyChallengeUpdate {
  return {
    dailyChestUnlocked: false,
    dailyMissionsCompleted: [],
    leveledUp: false,
    levelRewards: [],
    newlyUnlockedAchievements: [],
    nextLevel: profile.level,
    previousLevel: profile.level,
    profile,
    rewardCoins: 0,
    rewardXp: 0,
    unlockedWorlds: [],
    weeklyChallengeCompleted: false,
  };
}

function getLevelReward(level: number): LevelReward {
  const fixedRewards: Record<number, LevelReward> = {
    2: { coins: 50, level: 2, powerUps: [{ id: 'compass', quantity: 1 }] },
    3: { coins: 75, level: 3, powerUps: [{ id: 'camera', quantity: 1 }] },
    4: { coins: 100, level: 4, powerUps: [{ id: 'fast-travel', quantity: 1 }, { id: 'compass', quantity: 1 }] },
    5: { coins: 125, level: 5, powerUps: [{ id: 'golden-passport', quantity: 1 }] },
    6: { coins: 150, level: 6, powerUps: [{ id: 'shuffle', quantity: 1 }, { id: 'camera', quantity: 1 }] },
    7: { coins: 175, level: 7, powerUps: [{ id: 'souvenir', quantity: 1 }, { id: 'fast-travel', quantity: 1 }] },
    8: { coins: 200, level: 8, powerUps: [{ id: 'golden-passport', quantity: 1 }, { id: 'shuffle', quantity: 1 }] },
    9: { coins: 250, level: 9, powerUps: [{ id: 'camera', quantity: 2 }, { id: 'compass', quantity: 2 }] },
    10: { coins: 300, level: 10, powerUps: [{ id: 'golden-passport', quantity: 2 }, { id: 'souvenir', quantity: 2 }] },
  };

  if (fixedRewards[level]) {
    return fixedRewards[level];
  }

  const rotatingPowerUps: PowerUpId[] = ['compass', 'camera', 'fast-travel', 'shuffle', 'golden-passport', 'souvenir'];
  const firstPowerUp = rotatingPowerUps[level % rotatingPowerUps.length];
  const secondPowerUp = rotatingPowerUps[(level + 3) % rotatingPowerUps.length];

  return {
    coins: Math.min(500, 300 + Math.max(0, level - 10) * 25),
    level,
    powerUps: [
      { id: firstPowerUp, quantity: 1 },
      ...(level % 2 === 0 ? [{ id: secondPowerUp, quantity: 1 }] : []),
    ],
  };
}

function grantLevelRewards(profile: PlayerProfile, previousLevel: number, nextLevel: number): { profile: PlayerProfile; rewards: LevelReward[] } {
  if (nextLevel <= previousLevel) {
    return { profile, rewards: [] };
  }

  const claimedLevels = new Set(profile.claimedLevelRewards);
  const rewards: LevelReward[] = [];
  let coins = profile.coins;
  const powerUpInventory = { ...profile.powerUpInventory };

  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    if (claimedLevels.has(level)) {
      continue;
    }

    const reward = getLevelReward(level);
    rewards.push(reward);
    claimedLevels.add(level);
    coins += reward.coins;
    reward.powerUps.forEach((powerUp) => {
      powerUpInventory[powerUp.id] = (powerUpInventory[powerUp.id] ?? 0) + powerUp.quantity;
    });
  }

  if (rewards.length === 0) {
    return { profile, rewards };
  }

  return {
    profile: {
      ...profile,
      claimedLevelRewards: Array.from(claimedLevels).sort((firstLevel, secondLevel) => firstLevel - secondLevel),
      coins,
      powerUpInventory,
    },
    rewards,
  };
}

function awardBonus(profile: PlayerProfile, rewardXp: number, rewardCoins: number): PlayerProfile {
  let level = profile.level;
  let xp = profile.xp + rewardXp;
  let nextLevelXp = getXpForLevel(level);

  while (xp >= nextLevelXp) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = getXpForLevel(level);
  }

  return {
    ...profile,
    coins: profile.coins + rewardCoins,
    level,
    nextLevelXp,
    xp,
  };
}

function awardXp(profile: PlayerProfile, rewardXp: number): { leveledUp: boolean; profile: PlayerProfile } {
  let level = profile.level;
  let xp = profile.xp + rewardXp;
  let nextLevelXp = getXpForLevel(level);
  let leveledUp = false;

  while (xp >= nextLevelXp) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = getXpForLevel(level);
    leveledUp = true;
  }

  return {
    leveledUp,
    profile: {
      ...profile,
      level,
      nextLevelXp,
      xp,
    },
  };
}

function getDailyProgressForToday(profile: PlayerProfile, missions = getDailyMissions()): DailyMissionsProgress {
  const dateKey = missions[0]?.dateKey ?? getTodayDateKey();

  if (!profile.dailyMissions || profile.dailyMissions.dateKey !== dateKey) {
    return createDailyMissionsProgress(missions);
  }

  return profile.dailyMissions;
}

function getWeeklyProgressForCurrentWeek(profile: PlayerProfile, challenge = getWeeklyChallenge()): WeeklyChallengeProgress {
  if (!profile.weeklyChallenge || profile.weeklyChallenge.weekKey !== challenge.weekKey || profile.weeklyChallenge.challengeId !== challenge.id) {
    return createWeeklyChallengeProgress(challenge);
  }

  return profile.weeklyChallenge;
}

export function getXpForLevel(level: number): number {
  const currentLevel = Math.max(1, level);

  return 500 + currentLevel * currentLevel * 220;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function parseDuration(value: string): number | null {
  const [minutes, seconds] = value.split(':').map(Number);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function getDefaultProfile(): PlayerProfile {
  return {
    ...playerProfile,
    nextLevelXp: getXpForLevel(playerProfile.level),
  };
}

function hydrateProfile(storedProfile?: Partial<StoredProfile>): PlayerProfile {
  const defaultProfile = getDefaultProfile();
  const level = storedProfile?.level ?? defaultProfile.level;

  return {
    ...defaultProfile,
    ...storedProfile,
    level,
    nextLevelXp: getXpForLevel(level),
    losses: storedProfile?.losses ?? defaultProfile.losses,
    unlockedAchievements: storedProfile?.unlockedAchievements ?? defaultProfile.unlockedAchievements,
    classicWins: storedProfile?.classicWins ?? defaultProfile.classicWins,
    dailyMissionsCompleted: storedProfile?.dailyMissionsCompleted ?? defaultProfile.dailyMissionsCompleted,
    weeklyChallengesCompleted: storedProfile?.weeklyChallengesCompleted ?? defaultProfile.weeklyChallengesCompleted,
    perfectWins: storedProfile?.perfectWins ?? defaultProfile.perfectWins,
    highestCombo: storedProfile?.highestCombo ?? Math.max(defaultProfile.highestCombo, storedProfile?.bestCombo ?? 0),
    worldCompletions: hydrateWorldCompletions(storedProfile),
    powerUpInventory: hydratePowerUpInventory(storedProfile),
    claimedLevelRewards: Array.isArray(storedProfile?.claimedLevelRewards)
      ? storedProfile.claimedLevelRewards.filter((levelReward) => Number.isInteger(levelReward) && levelReward > 1)
      : defaultProfile.claimedLevelRewards,
    dailyMissions: hydrateDailyMissionsProgress(storedProfile),
    weeklyChallenge: hydrateWeeklyChallengeProgress(storedProfile),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const rawProfile = window.localStorage.getItem(storageKey);

    if (!rawProfile) {
      return getDefaultProfile();
    }

    return hydrateProfile(JSON.parse(rawProfile) as Partial<StoredProfile>);
  } catch {
    return getDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  const storedProfile: StoredProfile = {
    level: profile.level,
    xp: profile.xp,
    coins: profile.coins,
    totalGames: profile.totalGames,
    wins: profile.wins,
    losses: profile.losses,
    bestTime: profile.bestTime,
    bestCombo: profile.bestCombo,
    unlockedAchievements: profile.unlockedAchievements,
    classicWins: profile.classicWins,
    dailyMissionsCompleted: profile.dailyMissionsCompleted,
    weeklyChallengesCompleted: profile.weeklyChallengesCompleted,
    perfectWins: profile.perfectWins,
    highestCombo: profile.highestCombo,
    worldCompletions: profile.worldCompletions,
    powerUpInventory: profile.powerUpInventory,
    claimedLevelRewards: profile.claimedLevelRewards,
    dailyMissions: profile.dailyMissions,
    weeklyChallenge: profile.weeklyChallenge,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(storedProfile));
}

export function purchaseShopItem(profile: PlayerProfile, itemId: string): ShopActionResult {
  const item = shopItemsById.get(itemId as PowerUpId);

  if (!item) {
    return { ok: false, message: 'That shop item is not available right now.', profile };
  }

  if (profile.coins < item.price) {
    return {
      ok: false,
      message: `You need ${item.price - profile.coins} more coins for ${item.name}.`,
      profile,
    };
  }

  const nextProfile = {
    ...profile,
    coins: profile.coins - item.price,
    powerUpInventory: {
      ...profile.powerUpInventory,
      [item.id]: (profile.powerUpInventory[item.id] ?? 0) + 1,
    },
  };

  const achievementUpdate = unlockAchievements(nextProfile, getCollectorAchievementIds(nextProfile));

  return {
    ok: true,
    message: `${item.name} added to your travel gear.`,
    profile: achievementUpdate.profile,
  };
}

export function consumePowerUp(profile: PlayerProfile, powerUpId: PowerUpId): ShopActionResult {
  const item = shopItemsById.get(powerUpId);

  if (!item) {
    return { ok: false, message: 'That travel gear is not available right now.', profile };
  }

  const quantity = profile.powerUpInventory[powerUpId] ?? 0;

  if (quantity <= 0) {
    return { ok: false, message: `You do not have any ${item.name} left.`, profile };
  }

  return {
    ok: true,
    message: `${item.name} used.`,
    profile: {
      ...profile,
      powerUpInventory: {
        ...profile.powerUpInventory,
        [powerUpId]: quantity - 1,
      },
    },
  };
}

export function resetStoredProfile(): PlayerProfile {
  window.localStorage.removeItem(storageKey);

  return getDefaultProfile();
}

export function applyLossProgress(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    totalGames: profile.totalGames + 1,
    losses: profile.losses + 1,
  };
}

export function markWorldModeCompleted(profile: PlayerProfile, worldId: string, modeId: string): PlayerProfile {
  if (!worldIds.has(worldId) || !modeIds.has(modeId)) {
    return profile;
  }

  if (profile.worldCompletions[worldId]?.[modeId]) {
    return profile;
  }

  return {
    ...profile,
    worldCompletions: {
      ...profile.worldCompletions,
      [worldId]: {
        ...profile.worldCompletions[worldId],
        [modeId]: true,
      },
    },
  };
}

function doesGameCompleteDailyMission(missionType: DailyMissionType, result: DailyChallengeGameResult): boolean {
  if (result.live && missionType !== 'combo-4' && missionType !== 'use-2-power-ups') {
    return false;
  }

  switch (missionType) {
    case 'win-any':
      return result.won;
    case 'win-under-90':
      return result.won && result.elapsedSeconds < 90;
    case 'combo-4':
      return result.bestCombo >= 4;
    case 'survival-complete':
      return result.won && result.modeId === 'survival';
    case 'use-2-power-ups':
      return result.powerUpsUsed >= 2;
    case 'max-3-mismatches':
      return result.won && result.mismatchCount <= 3;
    case 'beat-ai-easy-medium':
      return result.modeId === 'ai' && result.aiOutcome === 'player' && (result.aiDifficulty === 'easy' || result.aiDifficulty === 'medium');
    default:
      return false;
  }
}

function getWeeklyProgressIncrement(challengeType: WeeklyChallengeType, result: DailyChallengeGameResult): number {
  if (result.live && challengeType !== 'combo-6') {
    return 0;
  }

  switch (challengeType) {
    case 'win-10':
      return result.won ? 1 : 0;
    case 'beat-hard-ai-3':
      return result.modeId === 'ai' && result.aiOutcome === 'player' && result.aiDifficulty === 'hard' ? 1 : 0;
    case 'survival-5':
      return result.won && result.modeId === 'survival' ? 1 : 0;
    case 'score-3000':
      return Math.max(0, result.score);
    case 'use-15-power-ups':
      return Math.max(0, result.powerUpsUsed);
    case 'combo-6':
      return result.bestCombo;
    default:
      return 0;
  }
}

export function applyDailyChallengeProgress(profile: PlayerProfile, result: DailyChallengeGameResult): DailyChallengeUpdate {
  const previouslyUnlockedWorldIds = new Set(getWorldsForLevel(profile.level, profile.worldCompletions).filter((world) => world.unlocked).map((world) => world.id));
  const missions = getDailyMissions();
  const weeklyChallenge = getWeeklyChallenge();
  const currentDailyProgress = getDailyProgressForToday(profile, missions);
  const currentWeeklyProgress = getWeeklyProgressForCurrentWeek(profile, weeklyChallenge);
  let nextProfile: PlayerProfile = {
    ...profile,
    dailyMissions: currentDailyProgress,
    weeklyChallenge: currentWeeklyProgress,
  };
  const completedMissions: DailyMission[] = [];
  let rewardCoins = 0;
  let rewardXp = 0;
  let dailyChestUnlocked = false;
  let weeklyChallengeCompleted = false;
  let leveledUp = false;
  let levelRewards: LevelReward[] = [];
  const dailyMissionsProgress: DailyMissionsProgress = {
    ...currentDailyProgress,
    missions: { ...currentDailyProgress.missions },
  };

  missions.forEach((mission) => {
    const missionProgress = dailyMissionsProgress.missions[mission.id] ?? { completed: false, rewarded: false };

    if (missionProgress.rewarded || !doesGameCompleteDailyMission(mission.type, result)) {
      dailyMissionsProgress.missions[mission.id] = missionProgress;
      return;
    }

    dailyMissionsProgress.missions[mission.id] = { completed: true, rewarded: true };
    completedMissions.push(mission);
    rewardCoins += mission.rewardCoins;
    rewardXp += mission.rewardXp;
  });

  if (!dailyMissionsProgress.chestRewarded && getDailyChestProgress(dailyMissionsProgress, missions) === 3) {
    dailyMissionsProgress.chestRewarded = true;
    dailyChestUnlocked = true;
    rewardCoins += 50;
    rewardXp += 150;
  }

  let weeklyProgress = getWeeklyProgressForCurrentWeek(nextProfile, weeklyChallenge);

  if (!weeklyProgress.rewarded) {
    const progressIncrement = getWeeklyProgressIncrement(weeklyChallenge.type, result);
    const nextWeeklyProgressValue =
      weeklyChallenge.type === 'combo-6'
        ? Math.max(weeklyProgress.progress, progressIncrement)
        : weeklyProgress.progress + progressIncrement;

    weeklyProgress = {
      ...weeklyProgress,
      completed: nextWeeklyProgressValue >= weeklyChallenge.target,
      progress: Math.min(weeklyChallenge.target, nextWeeklyProgressValue),
    };

    if (weeklyProgress.completed) {
      weeklyProgress = { ...weeklyProgress, rewarded: true };
      weeklyChallengeCompleted = true;
      rewardCoins += weeklyChallenge.rewardCoins;
      rewardXp += weeklyChallenge.rewardXp;
    }
  }

  nextProfile = {
    ...nextProfile,
    dailyMissionsCompleted: nextProfile.dailyMissionsCompleted + completedMissions.length,
    weeklyChallengesCompleted: nextProfile.weeklyChallengesCompleted + (weeklyChallengeCompleted ? 1 : 0),
    dailyMissions: dailyMissionsProgress,
    weeklyChallenge: weeklyProgress,
  };

  if (rewardCoins > 0 || rewardXp > 0) {
    const previousLevel = nextProfile.level;
    nextProfile = awardBonus(nextProfile, rewardXp, rewardCoins);
    leveledUp = nextProfile.level > previousLevel;
  }

  const achievementUpdate = unlockAchievements(nextProfile, getDailyWeeklyAchievementIds(nextProfile));
  nextProfile = achievementUpdate.profile;
  rewardXp += achievementUpdate.rewardXp;
  leveledUp = leveledUp || achievementUpdate.leveledUp;
  levelRewards = [...levelRewards, ...achievementUpdate.levelRewards];

  const levelRewardUpdate = grantLevelRewards(nextProfile, profile.level, nextProfile.level);
  nextProfile = levelRewardUpdate.profile;
  levelRewards = [...levelRewards, ...levelRewardUpdate.rewards];

  if (completedMissions.length === 0 && !dailyChestUnlocked && !weeklyChallengeCompleted) {
    return emptyDailyChallengeUpdate(nextProfile);
  }

  const unlockedWorlds = getWorldsForLevel(nextProfile.level, nextProfile.worldCompletions).filter(
    (world) => world.unlocked && !previouslyUnlockedWorldIds.has(world.id),
  );

  return {
    dailyChestUnlocked,
    dailyMissionsCompleted: completedMissions,
    leveledUp,
    levelRewards,
    newlyUnlockedAchievements: achievementUpdate.newlyUnlockedAchievements,
    nextLevel: nextProfile.level,
    previousLevel: profile.level,
    profile: nextProfile,
    rewardCoins,
    rewardXp,
    unlockedWorlds,
    weeklyChallengeCompleted,
  };
}

export function applyVictoryProgress(profile: PlayerProfile, victory: VictoryProgress): ProgressUpdate {
  const previouslyUnlockedWorldIds = new Set(getWorldsForLevel(profile.level, profile.worldCompletions).filter((world) => world.unlocked).map((world) => world.id));
  let level = profile.level;
  let xp = profile.xp + victory.earnedXp;
  let nextLevelXp = getXpForLevel(level);
  let leveledUp = false;

  while (xp >= nextLevelXp) {
    xp -= nextLevelXp;
    level += 1;
    nextLevelXp = getXpForLevel(level);
    leveledUp = true;
  }

  const currentBestTime = parseDuration(profile.bestTime);
  const bestTime =
    currentBestTime === null || victory.elapsedSeconds < currentBestTime
      ? formatDuration(victory.elapsedSeconds)
      : profile.bestTime;

  const nextProfile: PlayerProfile = {
    ...profile,
    level,
    xp,
    nextLevelXp,
    coins: profile.coins + victory.earnedCoins,
    totalGames: profile.totalGames + 1,
    wins: profile.wins + 1,
    classicWins: profile.classicWins + (victory.modeId === 'classic' ? 1 : 0),
    bestCombo: Math.max(profile.bestCombo, victory.bestCombo),
    highestCombo: Math.max(profile.highestCombo, victory.bestCombo),
    perfectWins: profile.perfectWins + (victory.mismatchCount === 0 ? 1 : 0),
    bestTime,
  };
  const profileWithWorldCompletion =
    victory.worldId && victory.modeId ? markWorldModeCompleted(nextProfile, victory.worldId, victory.modeId) : nextProfile;
  const achievementUpdate = unlockAchievements(
    profileWithWorldCompletion,
    getVictoryAchievementIds(profileWithWorldCompletion, victory),
  );
  const levelRewardUpdate = grantLevelRewards(achievementUpdate.profile, profile.level, achievementUpdate.profile.level);
  const finalProfile = levelRewardUpdate.profile;
  const newlyUnlockedWorlds = getWorldsForLevel(finalProfile.level, finalProfile.worldCompletions).filter(
    (world) => world.unlocked && !previouslyUnlockedWorldIds.has(world.id),
  );

  return {
    leveledUp: leveledUp || achievementUpdate.leveledUp,
    previousLevel: profile.level,
    nextLevel: finalProfile.level,
    levelRewards: [...achievementUpdate.levelRewards, ...levelRewardUpdate.rewards],
    newlyUnlockedAchievements: achievementUpdate.newlyUnlockedAchievements,
    profile: finalProfile,
    unlockedWorlds: newlyUnlockedWorlds,
  };
}

export function getWorldsForLevel(level: number, worldCompletions: PlayerProfile['worldCompletions'] = {}): World[] {
  return worlds.map((world) => ({
    ...world,
    unlocked: level >= (worldUnlockLevels[world.id] ?? 1),
    progress:
      level >= (worldUnlockLevels[world.id] ?? 1)
        ? Math.round((gameModes.filter((mode) => worldCompletions[world.id]?.[mode.id]).length / gameModes.length) * 100)
        : 0,
  }));
}

export function getAchievementDefinition(id: string): Achievement | undefined {
  return achievementDefinitionsById.get(id);
}

export function getAchievementsForProfile(profile: PlayerProfile): Achievement[] {
  return achievements.map((achievement) => {
    const progress = getAchievementProgressValue(profile, achievement.id);
    const unlocked = profile.unlockedAchievements.includes(achievement.id);

    return {
      ...achievement,
      progress: unlocked ? achievement.target : Math.min(achievement.target, progress),
      unlocked,
    };
  });
}

export function unlockAchievements(profile: PlayerProfile, achievementIds: string[]): AchievementProgress {
  const unlockedSet = new Set(profile.unlockedAchievements);
  const newlyUnlockedAchievements: Achievement[] = [];
  let rewardXp = 0;

  achievementIds.forEach((achievementId) => {
    const achievement = achievementDefinitionsById.get(achievementId);

    if (!achievement || unlockedSet.has(achievementId)) {
      return;
    }

    unlockedSet.add(achievementId);
    newlyUnlockedAchievements.push({ ...achievement, unlocked: true, progress: achievement.target });
    rewardXp += achievement.reward;
  });

  const xpUpdate = rewardXp > 0 ? awardXp(profile, rewardXp) : { leveledUp: false, profile };
  const levelRewardUpdate = grantLevelRewards(xpUpdate.profile, profile.level, xpUpdate.profile.level);

  return {
    leveledUp: xpUpdate.leveledUp,
    levelRewards: levelRewardUpdate.rewards,
    newlyUnlockedAchievements,
    rewardXp,
    profile: {
      ...levelRewardUpdate.profile,
      unlockedAchievements: Array.from(unlockedSet),
    },
  };
}

export function unlockGameplayAchievement(profile: PlayerProfile, achievementId: string): AchievementProgress {
  return unlockAchievements(profile, [achievementId]);
}

export function unlockGameplayAchievements(profile: PlayerProfile, achievementIds: string[]): AchievementProgress {
  return unlockAchievements(profile, achievementIds);
}

function getVictoryAchievementIds(profile: PlayerProfile, victory: VictoryProgress): string[] {
  const achievementIds: string[] = [];

  if (victory.elapsedSeconds < 60) {
    achievementIds.push('speed-runner');
  }

  if (profile.level >= 20) {
    achievementIds.push('master-explorer');
  }

  if (profile.unlockedAchievements.length >= 9) {
    achievementIds.push('badge-hunter');
  }

  return [
    ...achievementIds,
    ...getClassicAchievementIds(profile),
    ...getComboAchievementIds(profile),
    ...getPerfectAchievementIds(profile),
    ...getWorldAchievementIds(profile),
    ...getCollectorAchievementIds(profile),
  ];
}

function getTierAchievementIds(baseId: string, value: number, tiers: Array<[string, number]>): string[] {
  return tiers.filter(([, target]) => value >= target).map(([tier]) => `${baseId}-${tier}`);
}

function getClassicAchievementIds(profile: PlayerProfile): string[] {
  return getTierAchievementIds('classic-master', profile.classicWins, [['bronze', 10], ['silver', 30], ['gold', 50]]);
}

function getComboAchievementIds(profile: PlayerProfile): string[] {
  return getTierAchievementIds('combo-legend', profile.highestCombo, [['bronze', 5], ['silver', 10], ['gold', 15]]);
}

function getDailyWeeklyAchievementIds(profile: PlayerProfile): string[] {
  return [
    ...getTierAchievementIds('daily-champion', profile.dailyMissionsCompleted, [['bronze', 5], ['silver', 20], ['gold', 50]]),
    ...getTierAchievementIds('weekly-warrior', profile.weeklyChallengesCompleted, [['bronze', 1], ['silver', 5], ['gold', 10]]),
  ];
}

function getPerfectAchievementIds(profile: PlayerProfile): string[] {
  return getTierAchievementIds('perfect-memory', profile.perfectWins, [['bronze', 1], ['silver', 5], ['gold', 15]]);
}

function getWorldAchievementIds(profile: PlayerProfile): string[] {
  const unlockedWorldCount = getWorldsForLevel(profile.level, profile.worldCompletions).filter((world) => world.unlocked).length;

  return getTierAchievementIds('world-traveler', unlockedWorldCount, [['bronze', 2], ['silver', 4], ['gold', worlds.length]]);
}

function getCollectorAchievementIds(profile: PlayerProfile): string[] {
  const ownedItemCount = shopItems.filter((item) => (profile.powerUpInventory[item.id] ?? 0) > 0).length;

  return getTierAchievementIds('collector', ownedItemCount, [['bronze', 3], ['silver', 10], ['gold', shopItems.length]]);
}

function getAchievementProgressValue(profile: PlayerProfile, achievementId: string): number {
  switch (achievementId) {
    case 'classic-master-bronze':
    case 'classic-master-silver':
    case 'classic-master-gold':
      return profile.classicWins;
    case 'combo-legend-bronze':
    case 'combo-legend-silver':
    case 'combo-legend-gold':
      return profile.highestCombo;
    case 'world-traveler-bronze':
    case 'world-traveler-silver':
    case 'world-traveler-gold':
      return Math.min(5, getWorldsForLevel(profile.level).filter((world) => world.unlocked).length);
    case 'perfect-memory-bronze':
    case 'perfect-memory-silver':
    case 'perfect-memory-gold':
      return profile.perfectWins;
    case 'collector-bronze':
    case 'collector-silver':
    case 'collector-gold':
      return shopItems.filter((item) => (profile.powerUpInventory[item.id] ?? 0) > 0).length;
    case 'master-explorer':
      return profile.level;
    case 'badge-hunter':
      return profile.unlockedAchievements.length;
    case 'daily-champion-bronze':
    case 'daily-champion-silver':
    case 'daily-champion-gold':
      return profile.dailyMissionsCompleted;
    case 'weekly-warrior-bronze':
    case 'weekly-warrior-silver':
    case 'weekly-warrior-gold':
      return profile.weeklyChallengesCompleted;
    default:
      return profile.unlockedAchievements.includes(achievementId) ? 1 : 0;
  }
}
