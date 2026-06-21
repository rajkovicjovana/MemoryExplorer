import type { PlayerProfile, ScreenId, World } from '../types/game';
import { formatNumber } from '../utils/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatCard } from '../components/StatCard';

type MainMenuProps = {
  availableWorlds: World[];
  onNavigate: (screen: ScreenId) => void;
  profile: PlayerProfile;
};

export function MainMenu({ availableWorlds, onNavigate, profile }: MainMenuProps) {
  const unlockedWorlds = availableWorlds.filter((world) => world.unlocked).length;

  return (
    <section className="screen main-menu">
      <ScreenHeader
        title="Around the World"
        subtitle="Pick a destination, master every board, and build your explorer legacy."
      />

      <div className="hero-panel">
        <div className="destination-hero-art" aria-hidden="true">
          <div className="travel-sky" />
          <div className="travel-sun" />
          <div className="travel-cloud cloud-one" />
          <div className="travel-cloud cloud-two" />
          <div className="travel-mountain mountain-one" />
          <div className="travel-mountain mountain-two" />
          <div className="travel-landmark tower" />
          <div className="travel-landmark dome" />
          <div className="travel-route" />
          <div className="travel-pin pin-one" />
          <div className="travel-pin pin-two" />
          <div className="floating-card card-one">EU</div>
          <div className="floating-card card-two">TP</div>
        </div>
        <div className="hero-copy">
          <img
            alt="Memory Explorer"
            className="asset-game-logo"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            src="/assets/logo/memory-explorer-logo.png"
          />
          <span className="badge premium-badge">Season 01 Expedition</span>
          <h2>Explorer Pass</h2>
          <p>Complete routes, collect souvenirs, and unlock new destination themes.</p>
          <button className="primary-button" onClick={() => onNavigate('world-select')} type="button">
            Start Journey
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Unlocked Worlds" value={`${unlockedWorlds}/${availableWorlds.length}`} tone="blue" />
        <StatCard label="Games Played" value={profile.totalGames} tone="green" />
        <StatCard label="Wins / Losses" value={`${profile.wins}/${profile.losses}`} tone="gold" />
        <StatCard label="Coins" value={formatNumber(profile.coins)} tone="pink" />
      </div>

      <div className="quick-actions">
        <button onClick={() => onNavigate('daily')} type="button">Daily Challenge</button>
        <button onClick={() => onNavigate('achievements')} type="button">Achievements</button>
        <button onClick={() => onNavigate('leaderboard')} type="button">Leaderboard</button>
      </div>
    </section>
  );
}
