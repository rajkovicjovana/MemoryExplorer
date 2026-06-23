import type { PlayerProfile } from '../types/game';
import { formatNumber } from '../utils/format';
import { getDailyChestProgress, getDailyMissions, getWeeklyChallenge } from '../utils/progression';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../i18n/useLanguage';

type DailyChallengeProps = {
  profile: PlayerProfile;
};

export function DailyChallenge({ profile }: DailyChallengeProps) {
  const { t } = useLanguage();
  const missions = getDailyMissions();
  const weeklyChallenge = getWeeklyChallenge();
  const dailyProgress = profile.dailyMissions;
  const weeklyProgress = profile.weeklyChallenge;
  const completedMissionCount =
    dailyProgress?.dateKey === missions[0]?.dateKey ? getDailyChestProgress(dailyProgress, missions) : 0;
  const weeklyProgressValue =
    weeklyProgress?.weekKey === weeklyChallenge.weekKey && weeklyProgress.challengeId === weeklyChallenge.id
      ? weeklyProgress.progress
      : 0;
  const weeklyCompleted =
    weeklyProgress?.weekKey === weeklyChallenge.weekKey &&
    weeklyProgress.challengeId === weeklyChallenge.id &&
    weeklyProgress.rewarded;

  return (
    <section className="screen daily-screen">
      <ScreenHeader title={t('daily.title')} subtitle={t('daily.subtitle')} />

      <div className="daily-section-header">
        <span className="eyebrow">{t('daily.todaysMissions')}</span>
        <strong>{t('daily.dailyChestProgress', { count: completedMissionCount })}</strong>
      </div>

      <div className="daily-mission-grid">
        {missions.map((mission) => {
          const missionProgress = dailyProgress?.dateKey === mission.dateKey ? dailyProgress.missions[mission.id] : undefined;
          const isClaimed = Boolean(missionProgress?.rewarded);

          return (
            <article className={isClaimed ? 'daily-card mission-card completed' : 'daily-card mission-card'} key={mission.id}>
              <span className={isClaimed ? 'badge premium-badge' : 'badge timer-badge'}>
                {isClaimed ? t('common.claimed') : t('common.open')}
              </span>
              <h2>{t(`dailyMissions.${mission.type}.title`)}</h2>
              <p>{t(`dailyMissions.${mission.type}.description`)}</p>
              <div className="reward-row">
                <span>{formatNumber(mission.rewardCoins)} {t('common.coins')}</span>
                <span>{formatNumber(mission.rewardXp)} {t('common.xp')}</span>
              </div>
            </article>
          );
        })}
      </div>

      <article className={completedMissionCount === 3 ? 'daily-card daily-chest-card completed' : 'daily-card daily-chest-card'}>
        <span className="badge premium-badge">{t('daily.dailyChest')}</span>
        <h2>{dailyProgress?.chestRewarded ? t('daily.chestClaimed') : t('daily.completeAllMissions')}</h2>
        <p>{t('daily.chestDescription')}</p>
        <div className="reward-row">
          <span>{completedMissionCount}/3 {t('common.done')}</span>
          <span>50 {t('common.coins')}</span>
          <span>150 {t('common.xp')}</span>
        </div>
      </article>

      <div className="daily-section-header weekly-header">
        <span className="eyebrow">{t('daily.weeklyChallenge')}</span>
        <strong>{weeklyChallenge.weekKey}</strong>
      </div>

      <article className={weeklyCompleted ? 'daily-card weekly-card completed' : 'daily-card weekly-card'}>
        <span className={weeklyCompleted ? 'badge premium-badge' : 'badge timer-badge'}>
          {weeklyCompleted ? t('common.claimed') : t('common.inProgress')}
        </span>
        <h2>{t(`weeklyChallenges.${weeklyChallenge.type}.title`)}</h2>
        <p>{t(`weeklyChallenges.${weeklyChallenge.type}.description`)}</p>
        <div className="reward-row">
          <span>
            {formatNumber(weeklyProgressValue)}/{formatNumber(weeklyChallenge.target)}
          </span>
          <span>{formatNumber(weeklyChallenge.rewardCoins)} {t('common.coins')}</span>
          <span>{formatNumber(weeklyChallenge.rewardXp)} {t('common.xp')}</span>
        </div>
      </article>
    </section>
  );
}
