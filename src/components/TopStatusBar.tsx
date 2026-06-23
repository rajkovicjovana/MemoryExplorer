import { useEffect, useState } from 'react';
import { Bell, BellOff, Music2, VolumeX } from 'lucide-react';
import type { PlayerProfile } from '../types/game';
import { isAudioMuted, isMusicMuted, toggleAudioMuted, toggleMusicMuted } from '../utils/audio';
import { formatNumber, percent } from '../utils/format';
import { ProgressBar } from './ProgressBar';

type TopStatusBarProps = {
  profile: PlayerProfile;
};

export function TopStatusBar({ profile }: TopStatusBarProps) {
  const [muted, setMuted] = useState(isAudioMuted);
  const [musicMuted, setMusicMuted] = useState(isMusicMuted);

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

  return (
    <header className="top-status">
      <div className="player-chip">
        <div className="explorer-avatar" aria-hidden="true">
          <span>🦊</span>
        </div>
        <div>
          <strong>{profile.name}</strong>
          <span className="top-rank">Level {profile.level}</span>
        </div>
      </div>
      <div className="status-metrics">
        <button
          aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
          className="audio-toggle"
          onClick={() => setMuted(toggleAudioMuted())}
          type="button"
        >
          {muted ? <BellOff aria-hidden="true" size={16} /> : <Bell aria-hidden="true" size={16} />}
        </button>
        <button
          aria-label={musicMuted ? 'Unmute music' : 'Mute music'}
          className="audio-toggle"
          onClick={() => setMusicMuted(toggleMusicMuted())}
          type="button"
        >
          {musicMuted ? <VolumeX aria-hidden="true" size={16} /> : <Music2 aria-hidden="true" size={16} />}
        </button>
        <ProgressBar value={percent(profile.xp, profile.nextLevelXp)} label={`${formatNumber(profile.xp)} XP`} />
        <div className="coin-pill">
          <span aria-hidden="true">C</span>
          {formatNumber(profile.coins)}
        </div>
      </div>
    </header>
  );
}
