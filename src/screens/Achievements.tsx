import type { PlayerProfile } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProgressBar } from '../components/ProgressBar';
import { percent } from '../utils/format';
import { getAchievementsForProfile } from '../utils/progression';

type AchievementsProps = {
  profile: PlayerProfile;
};

export function Achievements({ profile }: AchievementsProps) {
  const achievements = getAchievementsForProfile(profile);

  return (
    <section className="screen">
      <ScreenHeader title="Badges" subtitle="Prestige medals for your hardest expedition milestones." />
      <div className="badge-vault">
        {achievements.map((achievement, index) => (
          <article className={achievement.unlocked ? 'achievement-card unlocked' : 'achievement-card'} key={achievement.id}>
            <div className="achievement-medal" aria-hidden="true">
              <span>{achievement.unlocked ? index + 1 : '🔒'}</span>
            </div>
            <div>
              <span className="badge">{achievement.unlocked ? 'Unlocked' : 'Locked'}</span>
              <h2>{achievement.title}</h2>
              <p title={achievement.description}>{achievement.description}</p>
            </div>
            <ProgressBar
              value={percent(achievement.progress, achievement.target)}
              label={`${achievement.progress} / ${achievement.target}`}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
