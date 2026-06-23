import type { PlayerProfile } from '../types/game';
import { formatNumber } from '../utils/format';
import { getDailyChestProgress, getDailyMissions, getWeeklyChallenge } from '../utils/progression';
import { ScreenHeader } from '../components/ScreenHeader';

type DailyChallengeProps = {
  profile: PlayerProfile;
};

export function DailyChallenge({ profile }: DailyChallengeProps) {
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
      <ScreenHeader title="Daily Missions" subtitle="Complete daily routes and build toward a harder weekly goal." />

      <div className="daily-section-header">
        <span className="eyebrow">Today's Missions</span>
        <strong>Daily Chest {completedMissionCount}/3</strong>
      </div>

      <div className="daily-mission-grid">
        {missions.map((mission) => {
          const missionProgress = dailyProgress?.dateKey === mission.dateKey ? dailyProgress.missions[mission.id] : undefined;
          const isClaimed = Boolean(missionProgress?.rewarded);

          return (
            <article className={isClaimed ? 'daily-card mission-card completed' : 'daily-card mission-card'} key={mission.id}>
              <span className={isClaimed ? 'badge premium-badge' : 'badge timer-badge'}>
                {isClaimed ? 'Claimed' : 'Open'}
              </span>
              <h2>{mission.title}</h2>
              <p>{mission.description}</p>
              <div className="reward-row">
                <span>{formatNumber(mission.rewardCoins)} coins</span>
                <span>{formatNumber(mission.rewardXp)} XP</span>
              </div>
            </article>
          );
        })}
      </div>

      <article className={completedMissionCount === 3 ? 'daily-card daily-chest-card completed' : 'daily-card daily-chest-card'}>
        <span className="badge premium-badge">Daily Chest</span>
        <h2>{dailyProgress?.chestRewarded ? 'Chest Claimed' : 'Complete All Missions'}</h2>
        <p>Finish all 3 daily missions to unlock a one-time chest bonus.</p>
        <div className="reward-row">
          <span>{completedMissionCount}/3 done</span>
          <span>50 coins</span>
          <span>150 XP</span>
        </div>
      </article>

      <div className="daily-section-header weekly-header">
        <span className="eyebrow">Weekly Challenge</span>
        <strong>{weeklyChallenge.weekKey}</strong>
      </div>

      <article className={weeklyCompleted ? 'daily-card weekly-card completed' : 'daily-card weekly-card'}>
        <span className={weeklyCompleted ? 'badge premium-badge' : 'badge timer-badge'}>
          {weeklyCompleted ? 'Claimed' : 'In Progress'}
        </span>
        <h2>{weeklyChallenge.title}</h2>
        <p>{weeklyChallenge.description}</p>
        <div className="reward-row">
          <span>
            {formatNumber(weeklyProgressValue)}/{formatNumber(weeklyChallenge.target)}
          </span>
          <span>{formatNumber(weeklyChallenge.rewardCoins)} coins</span>
          <span>{formatNumber(weeklyChallenge.rewardXp)} XP</span>
        </div>
      </article>
    </section>
  );
}
