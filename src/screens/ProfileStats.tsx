import type { CSSProperties } from 'react';
import type { PlayerProfile, ScreenId } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProgressBar } from '../components/ProgressBar';
import { formatNumber, percent } from '../utils/format';

type ProfileStatsProps = {
  onNavigate: (screen: ScreenId) => void;
  onResetProgress: () => void;
  profile: PlayerProfile;
};

export function ProfileStats({ onNavigate, onResetProgress, profile }: ProfileStatsProps) {
  const winRate = profile.totalGames > 0 ? Math.round((profile.wins / profile.totalGames) * 100) : 0;
  const badgeCount = profile.unlockedAchievements.length;
  const rank = profile.level >= 10 ? 'Master Voyager' : profile.level >= 4 ? 'Trailblazer' : 'Rookie Explorer';

  return (
    <section className="screen">
      <ScreenHeader title="Explorer Profile" subtitle="Your route rank, badges, and best expedition records." />
      <div className="profile-hero-card">
        <div className="profile-avatar-stage">
          <div className="explorer-avatar large" aria-hidden="true"><span>🦊</span></div>
          <div className="level-orbit" style={{ '--level-progress': `${percent(profile.xp, profile.nextLevelXp)}%` } as CSSProperties}>
            <span>{profile.level}</span>
          </div>
        </div>
        <div className="profile-identity">
          <span className="eyebrow">Explorer Level {profile.level}</span>
          <h2>{profile.name}</h2>
          <strong className="profile-rank">{rank}</strong>
          <ProgressBar
            value={percent(profile.xp, profile.nextLevelXp)}
            label={`${formatNumber(profile.xp)} / ${formatNumber(profile.nextLevelXp)} XP`}
          />
          <div className="profile-coin-chip"><span>C</span>{formatNumber(profile.coins)}</div>
        </div>
      </div>

      <button className="badge-vault-button" onClick={() => onNavigate('achievements')} type="button">
        <span className="badge-vault-trophy" aria-hidden="true">🏆</span>
        <div>
          <strong>Badge Vault</strong>
          <small>{badgeCount} medals unlocked</small>
        </div>
      </button>

      <div className="profile-section-title">
        <span className="eyebrow">Recent Stats</span>
      </div>
      <div className="profile-stats-game-grid">
        <article className="profile-stat-big">
          <span>Games</span>
          <strong>{profile.totalGames}</strong>
        </article>
        <article className="profile-stat-ring" style={{ '--ring-progress': `${winRate}%` } as CSSProperties}>
          <span>Win Rate</span>
          <strong>{winRate}%</strong>
        </article>
        <article className="profile-stat-trophy">
          <span aria-hidden="true">🏆</span>
          <strong>{profile.bestCombo}x</strong>
          <small>Best Combo</small>
        </article>
        <article className="profile-stat-trophy">
          <span aria-hidden="true">⏱</span>
          <strong>{profile.bestTime}</strong>
          <small>Best Time</small>
        </article>
        <article className="profile-duel-stat">
          <div><strong>{profile.wins}</strong><span>Wins</span></div>
          <i aria-hidden="true">VS</i>
          <div><strong>{profile.losses}</strong><span>Losses</span></div>
        </article>
      </div>
      <button className="secondary-button reset-progress-button" onClick={onResetProgress} type="button">
        Reset Progress
      </button>
    </section>
  );
}
