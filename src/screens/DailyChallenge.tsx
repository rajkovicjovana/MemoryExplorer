import { dailyChallenge, gameModes, worlds } from '../data/gameData';
import { formatNumber } from '../utils/format';
import { ScreenHeader } from '../components/ScreenHeader';

export function DailyChallenge() {
  const world = worlds.find((item) => item.id === dailyChallenge.worldId);
  const mode = gameModes.find((item) => item.id === dailyChallenge.modeId);

  return (
    <section className="screen">
      <ScreenHeader title="Daily Challenge" subtitle="A rotating objective set ready for future gameplay rules." />
      <article className="daily-card">
        <span className="badge">{mode?.name ?? 'Special'} - {world?.name ?? 'Mystery World'}</span>
        <h2>{dailyChallenge.title}</h2>
        <p>{dailyChallenge.description}</p>
        <div className="reward-row">
          <span>{dailyChallenge.timeLimit}</span>
          <span>{formatNumber(dailyChallenge.rewardCoins)} coins</span>
          <span>{formatNumber(dailyChallenge.rewardXp)} XP</span>
        </div>
        <div className="objective-list">
          {dailyChallenge.objectives.map((objective) => (
            <div key={objective}>
              <span aria-hidden="true">+</span>
              {objective}
            </div>
          ))}
        </div>
        <button className="primary-button wide" type="button">Preview Challenge</button>
      </article>
    </section>
  );
}
