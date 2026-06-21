import { achievements, dailyMissionTemplates, playerProfile, shopItems, weeklyChallengeTemplates, worlds } from '../data/gameData';
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
};

export type ProgressUpdate = {
  newlyUnlockedAchievements: Achievement[];
  profile: PlayerProfile;
  leveledUp: boolean;
};

export type AchievementProgress = {
  newlyUnlockedAchievements: Achievement[];
  profile: PlayerProfile;
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
  | 'powerUpInventory'
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
  mismatchCount: number;
  modeId: string;
  powerUpsUsed: number;
  score: number;
  won: boolean;
};

export type DailyChallengeUpdate = {
  dailyChestUnlocked: boolean;
  dailyMissionsCompleted: DailyMission[];
  profile: PlayerProfile;
  rewardCoins: number;
  rewardXp: number;
  weeklyChallengeCompleted: boolean;
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
    profile,
    rewardCoins: 0,
    rewardXp: 0,
    weeklyChallengeCompleted: false,
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
  const levelIndex = Math.max(1, level) - 1;

  return 600 + levelIndex * 280 + levelIndex * levelIndex * 35;
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
    powerUpInventory: hydratePowerUpInventory(storedProfile),
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
    powerUpInventory: profile.powerUpInventory,
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

  return {
    ok: true,
    message: `${item.name} added to your travel gear.`,
    profile: {
      ...profile,
      coins: profile.coins - item.price,
      powerUpInventory: {
        ...profile.powerUpInventory,
        [item.id]: (profile.powerUpInventory[item.id] ?? 0) + 1,
      },
    },
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

function doesGameCompleteDailyMission(missionType: DailyMissionType, result: DailyChallengeGameResult): boolean {
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
    dailyMissions: dailyMissionsProgress,
    weeklyChallenge: weeklyProgress,
  };

  if (rewardCoins > 0 || rewardXp > 0) {
    nextProfile = awardBonus(nextProfile, rewardXp, rewardCoins);
  }

  if (completedMissions.length === 0 && !dailyChestUnlocked && !weeklyChallengeCompleted) {
    return emptyDailyChallengeUpdate(nextProfile);
  }

  return {
    dailyChestUnlocked,
    dailyMissionsCompleted: completedMissions,
    profile: nextProfile,
    rewardCoins,
    rewardXp,
    weeklyChallengeCompleted,
  };
}

export function applyVictoryProgress(profile: PlayerProfile, victory: VictoryProgress): ProgressUpdate {
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
    bestCombo: Math.max(profile.bestCombo, victory.bestCombo),
    bestTime,
  };
  const achievementUpdate = unlockAchievements(nextProfile, getVictoryAchievementIds(nextProfile, victory));

  return {
    leveledUp,
    newlyUnlockedAchievements: achievementUpdate.newlyUnlockedAchievements,
    profile: achievementUpdate.profile,
  };
}

export function getWorldsForLevel(level: number): World[] {
  return worlds.map((world) => ({
    ...world,
    unlocked: level >= (worldUnlockLevels[world.id] ?? 1),
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

  achievementIds.forEach((achievementId) => {
    const achievement = achievementDefinitionsById.get(achievementId);

    if (!achievement || unlockedSet.has(achievementId)) {
      return;
    }

    unlockedSet.add(achievementId);
    newlyUnlockedAchievements.push({ ...achievement, unlocked: true, progress: achievement.target });
  });

  return {
    newlyUnlockedAchievements,
    profile: {
      ...profile,
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
  const achievementIds = ['first-match', 'memory-rookie'];

  if (profile.level >= 2) {
    achievementIds.push('explorer');
  }

  if (profile.level >= 10) {
    achievementIds.push('world-traveler');
  }

  if (victory.elapsedSeconds < 60) {
    achievementIds.push('speed-runner');
  }

  if (victory.mismatchCount === 0) {
    achievementIds.push('perfect-memory');
  }

  if (victory.bestCombo >= 5) {
    achievementIds.push('combo-master');
  }

  if (profile.coins >= 1000) {
    achievementIds.push('collector');
  }

  return achievementIds;
}

function getAchievementProgressValue(profile: PlayerProfile, achievementId: string): number {
  switch (achievementId) {
    case 'memory-rookie':
      return profile.wins;
    case 'explorer':
      return profile.level >= 2 ? 1 : 0;
    case 'world-traveler':
      return profile.level >= 10 ? 1 : 0;
    case 'collector':
      return profile.coins;
    default:
      return profile.unlockedAchievements.includes(achievementId) ? 1 : 0;
  }
}
