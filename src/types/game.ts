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

export type ShopItem = {
  id: string;
  name: string;
  category: 'Theme' | 'Booster' | 'Card Back' | 'Avatar';
  price: number;
  owned: boolean;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
};

export type LeaderboardEntry = {
  rank: number;
  player: string;
  level: number;
  score: number;
  country: string;
};

export type DailyChallenge = {
  title: string;
  description: string;
  worldId: string;
  modeId: string;
  timeLimit: string;
  rewardCoins: number;
  rewardXp: number;
  objectives: string[];
};
