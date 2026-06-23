import { useState, type CSSProperties } from 'react';
import type { PlayerProfile, ScreenId } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProgressBar } from '../components/ProgressBar';
import { formatNumber, percent } from '../utils/format';
import { useLanguage } from '../i18n/useLanguage';

type ProfileStatsProps = {
  onNavigate: (screen: ScreenId) => void;
  onRenamePlayer: (name: string) => void;
  onResetProgress: () => void;
  profile: PlayerProfile;
};

export function ProfileStats({ onNavigate, onRenamePlayer, onResetProgress, profile }: ProfileStatsProps) {
  const { t } = useLanguage();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const winRate = profile.totalGames > 0 ? Math.round((profile.wins / profile.totalGames) * 100) : 0;
  const badgeCount = profile.unlockedAchievements.length;
  const rank = profile.level >= 10 ? t('profile.rankMaster') : profile.level >= 4 ? t('profile.rankTrailblazer') : t('profile.rankRookie');
  const savePlayerName = () => {
    const nextName = draftName.trim().replace(/\s+/g, ' ');

    if (nextName.length >= 2) {
      onRenamePlayer(nextName);
      setIsEditingName(false);
    }
  };

  return (
    <section className="screen">
      <ScreenHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <div className="profile-hero-card">
        <div className="profile-avatar-stage">
          <div className="explorer-avatar large" aria-hidden="true"><span>🦊</span></div>
          <div className="level-orbit" style={{ '--level-progress': `${percent(profile.xp, profile.nextLevelXp)}%` } as CSSProperties}>
            <span>{profile.level}</span>
          </div>
        </div>
        <div className="profile-identity">
          <span className="eyebrow">{t('profile.explorerLevel', { level: profile.level })}</span>
          {isEditingName ? (
            <div className="profile-name-editor">
              <input
                aria-label={t('profile.playerName')}
                autoFocus
                maxLength={24}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    savePlayerName();
                  }

                  if (event.key === 'Escape') {
                    setDraftName(profile.name);
                    setIsEditingName(false);
                  }
                }}
                value={draftName}
              />
              <button className="small-button" onClick={savePlayerName} type="button">
                {t('common.save')}
              </button>
            </div>
          ) : (
            <button
              className="profile-name-button"
              onClick={() => {
                setDraftName(profile.name);
                setIsEditingName(true);
              }}
              type="button"
            >
              {profile.name}
            </button>
          )}
          <strong className="profile-rank">{rank}</strong>
          <ProgressBar
            value={percent(profile.xp, profile.nextLevelXp)}
            label={`${formatNumber(profile.xp)} / ${formatNumber(profile.nextLevelXp)} ${t('common.xp')}`}
          />
          <div className="profile-coin-chip"><span>C</span>{formatNumber(profile.coins)}</div>
        </div>
      </div>

      <button className="badge-vault-button" onClick={() => onNavigate('achievements')} type="button">
        <span className="badge-vault-trophy" aria-hidden="true">🏆</span>
        <div>
          <strong>{t('profile.badgeVault')}</strong>
          <small>{t('profile.medalsUnlocked', { count: badgeCount })}</small>
        </div>
      </button>

      <div className="profile-section-title">
        <span className="eyebrow">{t('profile.recentStats')}</span>
      </div>
      <div className="profile-stats-game-grid">
        <article className="profile-stat-big">
          <span>{t('common.games')}</span>
          <strong>{profile.totalGames}</strong>
        </article>
        <article className="profile-stat-ring" style={{ '--ring-progress': `${winRate}%` } as CSSProperties}>
          <span>{t('common.winRate')}</span>
          <strong>{winRate}%</strong>
        </article>
        <article className="profile-stat-trophy">
          <span aria-hidden="true">🏆</span>
          <strong>{profile.bestCombo}x</strong>
          <small>{t('common.bestCombo')}</small>
        </article>
        <article className="profile-stat-trophy">
          <span aria-hidden="true">⏱</span>
          <strong>{profile.bestTime}</strong>
          <small>{t('common.bestTime')}</small>
        </article>
        <article className="profile-duel-stat">
          <div><strong>{profile.wins}</strong><span>{t('common.wins')}</span></div>
          <i aria-hidden="true">VS</i>
          <div><strong>{profile.losses}</strong><span>{t('common.losses')}</span></div>
        </article>
      </div>
      <button className="secondary-button reset-progress-button" onClick={onResetProgress} type="button">
        {t('profile.resetProgress')}
      </button>
    </section>
  );
}
