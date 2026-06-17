import { achievements, playerProfile, worlds } from '../data/gameData';
import type { Achievement, PlayerProfile, World } from '../types/game';

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
  'level' | 'xp' | 'coins' | 'totalGames' | 'wins' | 'losses' | 'bestTime' | 'bestCombo' | 'unlockedAchievements'
>;

const worldUnlockLevels: Record<string, number> = {
  europe: 1,
  tropics: 2,
  mountains: 4,
  city: 7,
  space: 10,
};

const achievementDefinitionsById = new Map(achievements.map((achievement) => [achievement.id, achievement]));

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
  };

  window.localStorage.setItem(storageKey, JSON.stringify(storedProfile));
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
