import type { PlayerProfile } from '../types/game';
import { formatNumber, percent } from '../utils/format';
import { ProgressBar } from './ProgressBar';

type TopStatusBarProps = {
  profile: PlayerProfile;
};

export function TopStatusBar({ profile }: TopStatusBarProps) {
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
        <ProgressBar value={percent(profile.xp, profile.nextLevelXp)} label={`${formatNumber(profile.xp)} XP`} />
        <div className="coin-pill">
          <span aria-hidden="true">C</span>
          {formatNumber(profile.coins)}
        </div>
      </div>
    </header>
  );
}
