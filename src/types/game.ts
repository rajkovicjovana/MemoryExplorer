export type ScreenId =
  | 'main-menu'
  | 'world-select'
  | 'mode-select'
  | 'gameplay'
  | 'profile'
  | 'achievements'
  | 'shop'
  | 'leaderboard'
  | 'daily';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export type PlayerProfile = {
  name: string;
  avatar: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  coins: number;
  totalGames: number;
  wins: number;
  losses: number;
  bestTime: string;
  bestCombo: number;
  unlockedAchievements: string[];
  powerUpInventory: Partial<Record<PowerUpId, number>>;
  dailyMissions: DailyMissionsProgress | null;
  weeklyChallenge: WeeklyChallengeProgress | null;
};

export type World = {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  unlocked: boolean;
  progress: number;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
  sampleCardSymbols: string[];
};

export type GameMode = {
  id: string;
  name: string;
  description: string;
  reward: string;
  recommendedFor: string;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  unlocked: boolean;
};

export type PowerUpId = 'compass' | 'camera' | 'fast-travel' | 'golden-passport' | 'shuffle' | 'souvenir';

export type ShopItem = {
  id: PowerUpId;
  name: string;
  description: string;
  price: number;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
};

export type LeaderboardEntry = {
  rank: number;
  player: string;
  level: number;
  score: number;
  country: string;
};

export type DailyMissionType =
  | 'win-any'
  | 'win-under-90'
  | 'combo-4'
  | 'survival-complete'
  | 'use-2-power-ups'
  | 'max-3-mismatches'
  | 'beat-ai-easy-medium';

export type DailyMission = {
  id: string;
  dateKey: string;
  type: DailyMissionType;
  title: string;
  description: string;
  rewardCoins: number;
  rewardXp: number;
};

export type DailyMissionProgress = {
  completed: boolean;
  rewarded: boolean;
};

export type DailyMissionsProgress = {
  dateKey: string;
  missions: Record<string, DailyMissionProgress>;
  chestRewarded: boolean;
};

export type WeeklyChallengeType =
  | 'win-10'
  | 'beat-hard-ai-3'
  | 'survival-5'
  | 'score-3000'
  | 'use-15-power-ups'
  | 'combo-6';

export type WeeklyChallenge = {
  id: string;
  weekKey: string;
  type: WeeklyChallengeType;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  rewardXp: number;
};

export type WeeklyChallengeProgress = {
  weekKey: string;
  challengeId: string;
  progress: number;
  completed: boolean;
  rewarded: boolean;
};
