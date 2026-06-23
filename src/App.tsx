import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { TopStatusBar } from './components/TopStatusBar';
import { gameModes } from './data/gameData';
import { Achievements } from './screens/Achievements';
import { DailyChallenge } from './screens/DailyChallenge';
import { GameplayPlaceholder } from './screens/GameplayPlaceholder';
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
  markWorldModeCompleted,
  purchaseShopItem,
  resetStoredProfile,
  saveProfile,
  unlockGameplayAchievements,
} from './utils/progression';
import { playSound, unlockAudio } from './utils/audio';
import { useLanguage } from './i18n/useLanguage';

function App() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState(loadProfile);
  const [activeScreen, setActiveScreen] = useState<ScreenId>('main-menu');
  const unlockedWorlds = useMemo(
    () => getWorldsForLevel(profile.level, profile.worldCompletions),
    [profile.level, profile.worldCompletions],
  );
  const [selectedWorld, setSelectedWorld] = useState<World>(unlockedWorlds[0]);
  const [selectedMode, setSelectedMode] = useState<GameMode>(gameModes[0]);
  const [duelPlayers, setDuelPlayers] = useState({ player1: 'Player 1', player2: 'Player 2' });
  const [activeGameExitHandler, setActiveGameExitHandler] = useState<((screen: ScreenId) => void) | null>(null);
  const screenStackRef = useRef<HTMLElement | null>(null);
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    const handleFirstInteraction = () => unlockAudio();
    const handleButtonClick = (event: PointerEvent | KeyboardEvent) => {
      const button = (event.target as HTMLElement).closest('button');

      if (button) {
        playSound('button-click', 0.46);
      }
    };
    const handleKeyboardButtonClick = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        handleButtonClick(event);
      }
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { capture: true });
    window.addEventListener('keydown', handleFirstInteraction, { capture: true });
    document.addEventListener('pointerup', handleButtonClick, { capture: true });
    document.addEventListener('keydown', handleKeyboardButtonClick, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction, { capture: true });
      window.removeEventListener('keydown', handleFirstInteraction, { capture: true });
      document.removeEventListener('pointerup', handleButtonClick, { capture: true });
      document.removeEventListener('keydown', handleKeyboardButtonClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    screenStackRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeScreen]);

  const currentSelectedWorld = useMemo(
    () => unlockedWorlds.find((world) => world.id === selectedWorld.id) ?? unlockedWorlds[0],
    [selectedWorld.id, unlockedWorlds],
  );


  const handleVictory = useCallback((victory: VictoryProgress): ProgressUpdate => {
    const update = applyVictoryProgress(profileRef.current, victory);

    profileRef.current = update.profile;
    setProfile(update.profile);

    return update;
  }, []);

  const handleLoss = useCallback(() => {
    const nextProfile = applyLossProgress(profileRef.current);

    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const handleWorldModeComplete = useCallback((worldId: string, modeId: string) => {
    const nextProfile = markWorldModeCompleted(profileRef.current, worldId, modeId);

    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }, []);

  const handleDailyChallengeCheck = useCallback((result: DailyChallengeGameResult): DailyChallengeUpdate => {
    const update = applyDailyChallengeProgress(profileRef.current, result);

    profileRef.current = update.profile;
    setProfile(update.profile);

    return update;
  }, []);

  const handleAchievementUnlock = useCallback((achievementIds: string[]): AchievementProgress => {
    const update = unlockGameplayAchievements(profileRef.current, achievementIds);

    if (update.newlyUnlockedAchievements.length > 0) {
      profileRef.current = update.profile;
      setProfile(update.profile);
    }

    return update;
  }, []);

  const handlePurchaseShopItem = useCallback((itemId: string) => {
    const result = purchaseShopItem(profileRef.current, itemId);

    if (result.profile !== profileRef.current) {
      profileRef.current = result.profile;
      setProfile(result.profile);
    }

    return result;
  }, []);

  const handleUsePowerUp = useCallback((powerUpId: PowerUpId) => {
    const result = consumePowerUp(profileRef.current, powerUpId);

    if (result.profile !== profileRef.current) {
      profileRef.current = result.profile;
      setProfile(result.profile);
    }

    return result;
  }, []);

  const handleRenamePlayer = useCallback((name: string) => {
    const trimmedName = name.trim().replace(/\s+/g, ' ').slice(0, 24);

    if (trimmedName.length < 2) {
      return;
    }

    setProfile((currentProfile) => {
      const nextProfile = { ...currentProfile, name: trimmedName };

      profileRef.current = nextProfile;
      return nextProfile;
    });
  }, []);

  const handleResetProgress = useCallback(() => {
    if (!window.confirm(t('profile.resetConfirm'))) {
      return;
    }

    const defaultProfile = resetStoredProfile();
    const defaultWorlds = getWorldsForLevel(defaultProfile.level, defaultProfile.worldCompletions);

    setProfile(defaultProfile);
    profileRef.current = defaultProfile;
    setSelectedWorld(defaultWorlds[0]);
    setActiveScreen('profile');
  }, [t]);

  const handleSelectWorld = useCallback((world: World) => {
    if (!world.unlocked) {
      return;
    }

    setSelectedWorld(world);
  }, []);

  const handleRegisterExitHandler = useCallback((handler: ((screen: ScreenId) => void) | null) => {
    setActiveGameExitHandler(() => handler);
  }, []);

  const handleNavigate = useCallback((screen: ScreenId) => {
    if (activeScreen === 'gameplay' && activeGameExitHandler && screen !== 'gameplay') {
      activeGameExitHandler(screen);
      return;
    }

    setActiveScreen(screen);
  }, [activeGameExitHandler, activeScreen]);

  const handleStartMode = useCallback((mode?: GameMode) => {
    if (mode) {
      setSelectedMode(mode);
    }

    setActiveScreen('gameplay');
  }, []);

  const activeContent = useMemo(() => {
    switch (activeScreen) {
      case 'world-select':
        return (
          <WorldSelect
            availableWorlds={unlockedWorlds}
            onContinue={() => setActiveScreen('mode-select')}
            onSelectWorld={handleSelectWorld}
            selectedWorld={currentSelectedWorld}
          />
        );
      case 'mode-select':
        return (
          <ModeSelect
            duelPlayers={duelPlayers}
            onPlay={handleStartMode}
            onSetDuelPlayers={setDuelPlayers}
            onSelectMode={setSelectedMode}
            selectedMode={selectedMode}
            selectedWorld={currentSelectedWorld}
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
            onRegisterExitHandler={handleRegisterExitHandler}
            onUsePowerUp={handleUsePowerUp}
            onVictory={handleVictory}
            onWorldModeComplete={handleWorldModeComplete}
            profile={profile}
            world={currentSelectedWorld}
          />
        );
      case 'profile':
        return (
          <ProfileStats
            onNavigate={setActiveScreen}
            onRenamePlayer={handleRenamePlayer}
            onResetProgress={handleResetProgress}
            profile={profile}
          />
        );
      case 'achievements':
        return <Achievements profile={profile} />;
      case 'shop':
        return (
          <Shop
            onPurchaseItem={handlePurchaseShopItem}
            profile={profile}
          />
        );
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
    handleRenamePlayer,
    handleRegisterExitHandler,
    handleResetProgress,
    handleSelectWorld,
    handleStartMode,
    handleWorldModeComplete,
    handleUsePowerUp,
    handleVictory,
    profile,
    currentSelectedWorld,
    duelPlayers,
    selectedMode,
    unlockedWorlds,
  ]);

  return (
    <div className="app-shell">
      <div className="phone-frame">
        <TopStatusBar profile={profile} />
        <main className="screen-stack" ref={screenStackRef}>{activeContent}</main>
        <BottomNav activeScreen={activeScreen} onNavigate={handleNavigate} />
      </div>
    </div>
  );
}

export default App;
