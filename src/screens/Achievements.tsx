import type { Achievement, PlayerProfile } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProgressBar } from '../components/ProgressBar';
import { percent } from '../utils/format';
import { getAchievementsForProfile } from '../utils/progression';

type AchievementsProps = {
  profile: PlayerProfile;
};

type BadgeFamily = {
  chain: string;
  current: Achievement;
  earnedTiers: Achievement[];
  tiers: Achievement[];
};

const tierOrder = ['Bronze', 'Silver', 'Gold'];

function getTierRank(achievement: Achievement): number {
  return tierOrder.indexOf(achievement.tier ?? '');
}

function groupAchievementFamilies(achievements: Achievement[]): BadgeFamily[] {
  const chainMap = new Map<string, Achievement[]>();
  const standaloneFamilies: BadgeFamily[] = [];

  achievements.forEach((achievement) => {
    if (!achievement.chain) {
      standaloneFamilies.push({
        chain: achievement.title,
        current: achievement,
        earnedTiers: achievement.unlocked ? [achievement] : [],
        tiers: [achievement],
      });
      return;
    }

    chainMap.set(achievement.chain, [...(chainMap.get(achievement.chain) ?? []), achievement]);
  });

  const chainedFamilies = Array.from(chainMap.entries()).map(([chain, familyAchievements]) => {
    const tiers = [...familyAchievements].sort((left, right) => getTierRank(left) - getTierRank(right));
    const current = tiers.find((achievement) => !achievement.unlocked) ?? tiers[tiers.length - 1];

    return {
      chain,
      current,
      earnedTiers: tiers.filter((achievement) => achievement.unlocked),
      tiers,
    };
  });

  return [...chainedFamilies, ...standaloneFamilies];
}

export function Achievements({ profile }: AchievementsProps) {
  const badgeFamilies = groupAchievementFamilies(getAchievementsForProfile(profile));

  return (
    <section className="screen">
      <ScreenHeader title="Badges" subtitle="Bronze, Silver, and Gold trophies for your expedition milestones." />
      <div className="badge-vault badge-family-vault">
        {badgeFamilies.map((family, index) => {
          const complete = family.tiers.every((achievement) => achievement.unlocked);
          const tierLabel = complete ? 'Complete' : family.current.tier ?? (family.current.unlocked ? 'Unlocked' : 'Locked');

          return (
            <article
              className={[
                'achievement-card',
                'badge-family-card',
                complete ? 'unlocked complete' : '',
                family.current.tier ? `tier-${family.current.tier.toLowerCase()}` : '',
              ].filter(Boolean).join(' ')}
              key={family.chain}
            >
              <div className="achievement-medal" aria-hidden="true">
                <span>{complete ? 'G' : family.current.tier?.[0] ?? index + 1}</span>
              </div>
              <div>
                <span className="badge">{tierLabel}</span>
                <h2>{family.chain}</h2>
                <strong className="achievement-chain">{family.current.title}</strong>
                <p title={family.current.description}>{complete ? 'All tiers earned.' : family.current.description}</p>
                <small className="achievement-reward">{complete ? 'Tier chain complete' : `Next reward: +${family.current.reward} XP`}</small>
              </div>
              <div className="tier-medal-row" aria-label={`${family.chain} tier progress`}>
                {family.tiers.map((tier) => (
                  <span
                    className={[
                      'tier-mini-medal',
                      tier.tier ? `tier-${tier.tier.toLowerCase()}` : '',
                      tier.unlocked ? 'earned' : '',
                    ].filter(Boolean).join(' ')}
                    key={tier.id}
                    title={`${tier.tier ?? tier.title}: ${tier.unlocked ? 'earned' : 'locked'}`}
                  >
                    {tier.tier?.[0] ?? 'B'}
                  </span>
                ))}
              </div>
              <ProgressBar
                value={complete ? 100 : percent(family.current.progress, family.current.target)}
                label={complete ? 'Complete' : `${family.current.progress} / ${family.current.target}`}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
