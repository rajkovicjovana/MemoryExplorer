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
import type { GameMode, ScreenId, World } from './types/game';
import type { AchievementProgress, ProgressUpdate, VictoryProgress } from './utils/progression';
import {
  applyLossProgress,
  applyVictoryProgress,
  getWorldsForLevel,
  loadProfile,
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

  const handleAchievementUnlock = useCallback((achievementIds: string[]): AchievementProgress => {
    const update = unlockGameplayAchievements(profile, achievementIds);

    if (update.newlyUnlockedAchievements.length > 0) {
      setProfile(update.profile);
    }

    return update;
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
            onPlay={() => setActiveScreen('gameplay')}
            onSelectMode={setSelectedMode}
            selectedMode={selectedMode}
            selectedWorld={selectedWorld}
          />
        );
      case 'gameplay':
        return (
          <GameplayPlaceholder
            mode={selectedMode}
            onAchievementUnlock={handleAchievementUnlock}
            onLoss={handleLoss}
            onNavigate={setActiveScreen}
            onVictory={handleVictory}
            world={selectedWorld}
          />
        );
      case 'profile':
        return <ProfileStats onResetProgress={handleResetProgress} profile={profile} />;
      case 'achievements':
        return <Achievements profile={profile} />;
      case 'shop':
        return <Shop />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'daily':
        return <DailyChallenge />;
      case 'main-menu':
      default:
        return <MainMenu availableWorlds={unlockedWorlds} onNavigate={setActiveScreen} profile={profile} />;
    }
  }, [
    activeScreen,
    handleAchievementUnlock,
    handleLoss,
    handleResetProgress,
    handleSelectWorld,
    handleVictory,
    profile,
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
