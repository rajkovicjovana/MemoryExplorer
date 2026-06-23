import type { Achievement, PlayerProfile } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { ProgressBar } from '../components/ProgressBar';
import { percent } from '../utils/format';
import { getAchievementsForProfile } from '../utils/progression';
import { useLanguage } from '../i18n/useLanguage';

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
  const { t } = useLanguage();
  const badgeFamilies = groupAchievementFamilies(getAchievementsForProfile(profile));

  return (
    <section className="screen">
      <ScreenHeader title={t('achievements.title')} subtitle={t('achievements.subtitle')} />
      <div className="badge-vault badge-family-vault">
        {badgeFamilies.map((family, index) => {
          const complete = family.tiers.every((achievement) => achievement.unlocked);
          const tierLabel = complete
            ? t('common.complete')
            : family.current.tier
              ? t(`tiers.${family.current.tier}`)
              : (family.current.unlocked ? t('common.unlocked') : t('common.locked'));
          const chainTitle = family.current.chain ? t(`achievementChains.${family.current.chain}`) : t(`achievementsList.${family.current.id}.title`);
          const currentTitle = t(`achievementsList.${family.current.id}.title`);
          const currentDescription = t(`achievementsList.${family.current.id}.description`);

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
                <h2>{chainTitle}</h2>
                <strong className="achievement-chain">{currentTitle}</strong>
                <p title={currentDescription}>{complete ? t('achievements.allTiersEarned') : currentDescription}</p>
                <small className="achievement-reward">
                  {complete ? t('achievements.tierChainComplete') : t('achievements.nextReward', { reward: family.current.reward })}
                </small>
              </div>
              <div className="tier-medal-row" aria-label={t('achievements.tierProgress', { chain: chainTitle })}>
                {family.tiers.map((tier) => (
                  <span
                    className={[
                      'tier-mini-medal',
                      tier.tier ? `tier-${tier.tier.toLowerCase()}` : '',
                      tier.unlocked ? 'earned' : '',
                    ].filter(Boolean).join(' ')}
                    key={tier.id}
                    title={`${tier.tier ? t(`tiers.${tier.tier}`) : t(`achievementsList.${tier.id}.title`)}: ${tier.unlocked ? t('achievements.earned') : t('common.locked')}`}
                  >
                    {tier.tier?.[0] ?? 'B'}
                  </span>
                ))}
              </div>
              <ProgressBar
                value={complete ? 100 : percent(family.current.progress, family.current.target)}
                label={complete ? t('common.complete') : `${family.current.progress} / ${family.current.target}`}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
