import { leaderboard } from '../data/gameData';
import { formatNumber } from '../utils/format';
import { ScreenHeader } from '../components/ScreenHeader';

export function Leaderboard() {
  return (
    <section className="screen">
      <ScreenHeader title="Leaderboard" subtitle="Sample global ranking for future ranked and AI duel modes." />
      <div className="leaderboard-list">
        {leaderboard.map((entry) => (
          <article className={entry.player === 'Ava Explorer' ? 'leaderboard-row current' : 'leaderboard-row'} key={entry.rank}>
            <strong className="rank">#{entry.rank}</strong>
            <div>
              <h2>{entry.player}</h2>
              <p>{entry.country} - Level {entry.level}</p>
            </div>
            <span>{formatNumber(entry.score)}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
