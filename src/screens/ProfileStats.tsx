import type { PlayerProfile } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';
import { formatNumber, percent } from '../utils/format';

type ProfileStatsProps = {
  onResetProgress: () => void;
  profile: PlayerProfile;
};

export function ProfileStats({ onResetProgress, profile }: ProfileStatsProps) {
  const winRate = profile.totalGames > 0 ? Math.round((profile.wins / profile.totalGames) * 100) : 0;

  return (
    <section className="screen">
      <ScreenHeader title="Profile" subtitle="Track long-term explorer growth and personal bests." />
      <div className="profile-card">
        <div className="avatar large">{profile.avatar}</div>
        <div>
          <span className="eyebrow">Explorer Level {profile.level}</span>
          <h2>{profile.name}</h2>
          <ProgressBar
            value={percent(profile.xp, profile.nextLevelXp)}
            label={`${formatNumber(profile.xp)} / ${formatNumber(profile.nextLevelXp)} XP`}
          />
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Games Played" value={profile.totalGames} />
        <StatCard label="Wins" value={profile.wins} tone="green" />
        <StatCard label="Losses" value={profile.losses} tone="pink" />
        <StatCard label="Win Rate" value={`${winRate}%`} tone="gold" />
        <StatCard label="Best Time" value={profile.bestTime} tone="pink" />
        <StatCard label="Best Combo" value={`${profile.bestCombo}x`} />
        <StatCard label="Coins" value={formatNumber(profile.coins)} tone="gold" />
      </div>
      <button className="secondary-button reset-progress-button" onClick={onResetProgress} type="button">
        Reset Progress
      </button>
    </section>
  );
}
