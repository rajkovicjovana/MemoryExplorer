import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { PlayerProfile } from '../types/game';
import { isAudioMuted, toggleAudioMuted } from '../utils/audio';
import { formatNumber, percent } from '../utils/format';
import { ProgressBar } from './ProgressBar';

type TopStatusBarProps = {
  profile: PlayerProfile;
};

export function TopStatusBar({ profile }: TopStatusBarProps) {
  const [muted, setMuted] = useState(isAudioMuted);

  useEffect(() => {
    const handleMuteChange = () => setMuted(isAudioMuted());

    window.addEventListener('memory-explorer-audio-muted-change', handleMuteChange);

    return () => window.removeEventListener('memory-explorer-audio-muted-change', handleMuteChange);
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
        <ProgressBar value={percent(profile.xp, profile.nextLevelXp)} label={`${formatNumber(profile.xp)} XP`} />
        <div className="coin-pill">
          <span aria-hidden="true">C</span>
          {formatNumber(profile.coins)}
        </div>
      </div>
    </header>
  );
}
