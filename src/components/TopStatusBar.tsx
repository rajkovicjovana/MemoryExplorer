import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Languages, Menu, Music2, VolumeX } from 'lucide-react';
import type { PlayerProfile } from '../types/game';
import { isAudioMuted, isMusicMuted, toggleAudioMuted, toggleMusicMuted } from '../utils/audio';
import { formatNumber, percent } from '../utils/format';
import { useLanguage } from '../i18n/useLanguage';
import { ProgressBar } from './ProgressBar';

type TopStatusBarProps = {
  profile: PlayerProfile;
};

export function TopStatusBar({ profile }: TopStatusBarProps) {
  const [muted, setMuted] = useState(isAudioMuted);
  const [musicMuted, setMusicMuted] = useState(isMusicMuted);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const { language, t, toggleLanguage } = useLanguage();

  useEffect(() => {
    const handleMuteChange = () => setMuted(isAudioMuted());
    const handleMusicMuteChange = () => setMusicMuted(isMusicMuted());

    window.addEventListener('memory-explorer-audio-muted-change', handleMuteChange);
    window.addEventListener('memory-explorer-music-muted-change', handleMusicMuteChange);

    return () => {
      window.removeEventListener('memory-explorer-audio-muted-change', handleMuteChange);
      window.removeEventListener('memory-explorer-music-muted-change', handleMusicMuteChange);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer, { capture: true });
    };
  }, [settingsOpen]);

  return (
    <header className="top-status">
      <div className="player-chip">
        <div className="explorer-avatar" aria-hidden="true">
          <span>🦊</span>
        </div>
        <div>
          <strong>{profile.name}</strong>
          <span className="top-rank">{t('common.level', { level: profile.level })}</span>
        </div>
      </div>
      <div className="status-metrics">
        <div className="settings-menu" ref={settingsRef}>
          <button
            aria-expanded={settingsOpen}
            aria-label="Settings"
            className="audio-toggle settings-toggle"
            onPointerDown={(event) => {
              event.preventDefault();
              setSettingsOpen((currentOpen) => !currentOpen);
            }}
            type="button"
          >
            <Menu aria-hidden="true" size={16} />
          </button>
          {settingsOpen ? (
            <div className="settings-dropdown" role="menu">
              <button
                aria-label={t('language.toggle')}
                className="settings-dropdown-item"
                onClick={toggleLanguage}
                role="menuitem"
                type="button"
              >
                <Languages aria-hidden="true" size={15} />
                <span>{language.toUpperCase()}</span>
              </button>
              <button
                aria-label={muted ? t('audio.unmuteSounds') : t('audio.muteSounds')}
                className="settings-dropdown-item"
                onClick={() => setMuted(toggleAudioMuted())}
                role="menuitem"
                type="button"
              >
                {muted ? <BellOff aria-hidden="true" size={15} /> : <Bell aria-hidden="true" size={15} />}
                <span>{muted ? t('audio.unmuteSounds') : t('audio.muteSounds')}</span>
              </button>
              <button
                aria-label={musicMuted ? t('audio.unmuteMusic') : t('audio.muteMusic')}
                className="settings-dropdown-item"
                onClick={() => setMusicMuted(toggleMusicMuted())}
                role="menuitem"
                type="button"
              >
                {musicMuted ? <VolumeX aria-hidden="true" size={15} /> : <Music2 aria-hidden="true" size={15} />}
                <span>{musicMuted ? t('audio.unmuteMusic') : t('audio.muteMusic')}</span>
              </button>
            </div>
          ) : null}
        </div>
        <div className="status-xp-row">
          <ProgressBar
            value={percent(profile.xp, profile.nextLevelXp)}
            label={`${formatNumber(profile.xp)} / ${formatNumber(profile.nextLevelXp)} ${t('common.xp')}`}
          />
          <div className="coin-pill">
            <span aria-hidden="true">C</span>
            {formatNumber(profile.coins)}
          </div>
        </div>
      </div>
    </header>
  );
}
