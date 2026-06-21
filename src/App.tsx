import { useCallback, useEffect, useMemo, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { TopStatusBar } from './components/TopStatusBar';
import { gameModes } from './data/gameData';
import { Achievements } from './screens/Achievements';
import { DailyChallenge } from './screens/DailyChallenge';
import { GameplayPlaceholder } from './screens/GameplayPlaceholder';
import { Leaderboard } from './screens/Leaderboard';
import { MainMenu } from './screens/MainMenu';
import { ModeSelect } from './screens/ModeSelect';
import { ProfileStats } from './screens/ProfileStats';
import { Shop } from './screens/Shop';
import { WorldSelect } from './screens/WorldSelect';
import type { GameMode, PowerUpId, ScreenId, World } from './types/game';
import type { AchievementProgress, DailyChallengeGameResult, DailyChallengeUpdate, ProgressUpdate, VictoryProgress } from './utils/progression';
import {
  applyDailyChallengeProgress,
  applyLossProgress,
  applyVictoryProgress,
  consumePowerUp,
  getWorldsForLevel,
  loadProfile,
  purchaseShopItem,
  resetStoredProfile,
  saveProfile,
  unlockGameplayAchievements,
} from './utils/progression';

function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [activeScreen, setActiveScreen] = useState<ScreenId>('main-menu');
  const unlockedWorlds = useMemo(() => getWorldsForLevel(profile.level), [profile.level]);
  const [selectedWorld, setSelectedWorld] = useState<World>(unlockedWorlds[0]);
  const [selectedMode, setSelectedMode] = useState<GameMode>(gameModes[0]);
  const [duelPlayers, setDuelPlayers] = useState({ player1: 'Player 1', player2: 'Player 2' });

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const handleVictory = useCallback((victory: VictoryProgress): ProgressUpdate => {
    const update = applyVictoryProgress(profile, victory);

    setProfile(update.profile);

    return update;
  }, [profile]);

  const handleLoss = useCallback(() => {
    setProfile((currentProfile) => applyLossProgress(currentProfile));
  }, []);

  const handleDailyChallengeCheck = useCallback((result: DailyChallengeGameResult): DailyChallengeUpdate => {
    let dailyUpdate: DailyChallengeUpdate | null = null;

    setProfile((currentProfile) => {
      dailyUpdate = applyDailyChallengeProgress(currentProfile, result);

      return dailyUpdate.profile;
    });

    return dailyUpdate ?? {
      dailyChestUnlocked: false,
      dailyMissionsCompleted: [],
      profile,
      rewardCoins: 0,
      rewardXp: 0,
      weeklyChallengeCompleted: false,
    };
  }, [profile]);

  const handleAchievementUnlock = useCallback((achievementIds: string[]): AchievementProgress => {
    const update = unlockGameplayAchievements(profile, achievementIds);

    if (update.newlyUnlockedAchievements.length > 0) {
      setProfile(update.profile);
    }

    return update;
  }, [profile]);

  const handlePurchaseShopItem = useCallback((itemId: string) => {
    const result = purchaseShopItem(profile, itemId);

    if (result.profile !== profile) {
      setProfile(result.profile);
    }

    return result;
  }, [profile]);

  const handleUsePowerUp = useCallback((powerUpId: PowerUpId) => {
    const result = consumePowerUp(profile, powerUpId);

    if (result.profile !== profile) {
      setProfile(result.profile);
    }

    return result;
  }, [profile]);

  const handleResetProgress = useCallback(() => {
    if (!window.confirm('Reset all local Memory Explorer progress?')) {
      return;
    }

    const defaultProfile = resetStoredProfile();
    const defaultWorlds = getWorldsForLevel(defaultProfile.level);

    setProfile(defaultProfile);
    setSelectedWorld(defaultWorlds[0]);
    setActiveScreen('profile');
  }, []);

  const handleSelectWorld = useCallback((world: World) => {
    if (!world.unlocked) {
      return;
    }

    setSelectedWorld(world);
  }, []);

  const activeContent = useMemo(() => {
    switch (activeScreen) {
      case 'world-select':
        return (
          <WorldSelect
            availableWorlds={unlockedWorlds}
            onContinue={() => setActiveScreen('mode-select')}
            onSelectWorld={handleSelectWorld}
            selectedWorld={selectedWorld}
          />
        );
      case 'mode-select':
        return (
          <ModeSelect
            duelPlayers={duelPlayers}
            onPlay={() => setActiveScreen('gameplay')}
            onSetDuelPlayers={setDuelPlayers}
            onSelectMode={setSelectedMode}
            selectedMode={selectedMode}
            selectedWorld={selectedWorld}
          />
        );
      case 'gameplay':
        return (
          <GameplayPlaceholder
            mode={selectedMode}
            duelPlayers={duelPlayers}
            onAchievementUnlock={handleAchievementUnlock}
            onLoss={handleLoss}
            onDailyChallengeCheck={handleDailyChallengeCheck}
            onNavigate={setActiveScreen}
            onUsePowerUp={handleUsePowerUp}
            onVictory={handleVictory}
            profile={profile}
            world={selectedWorld}
          />
        );
      case 'profile':
        return <ProfileStats onResetProgress={handleResetProgress} profile={profile} />;
      case 'achievements':
        return <Achievements profile={profile} />;
      case 'shop':
        return (
          <Shop
            onPurchaseItem={handlePurchaseShopItem}
            profile={profile}
          />
        );
      case 'leaderboard':
        return <Leaderboard />;
      case 'daily':
        return <DailyChallenge profile={profile} />;
      case 'main-menu':
      default:
        return <MainMenu availableWorlds={unlockedWorlds} onNavigate={setActiveScreen} profile={profile} />;
    }
  }, [
    activeScreen,
    handleAchievementUnlock,
    handleDailyChallengeCheck,
    handleLoss,
    handlePurchaseShopItem,
    handleResetProgress,
    handleSelectWorld,
    handleUsePowerUp,
    handleVictory,
    profile,
    duelPlayers,
    selectedMode,
    selectedWorld,
    unlockedWorlds,
  ]);

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <TopStatusBar profile={profile} />
        <main className="screen-stack">{activeContent}</main>
        <BottomNav activeScreen={activeScreen} onNavigate={setActiveScreen} />
      </div>
    </div>
  );
}

export default App;
