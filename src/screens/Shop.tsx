import { shopItems } from '../data/gameData';
import { formatNumber } from '../utils/format';
import { ScreenHeader } from '../components/ScreenHeader';

export function Shop() {
  return (
    <section className="screen">
      <ScreenHeader title="Shop" subtitle="Spend coins on cosmetic themes, boosts, card backs, and avatars." />
      <div className="shop-grid">
        {shopItems.map((item) => (
          <article className="shop-card" key={item.id}>
            <div className="shop-token" aria-hidden="true">
              {item.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="badge">{item.rarity}</span>
            <h2>{item.name}</h2>
            <p>{item.category}</p>
            <button className={item.owned ? 'secondary-button' : 'primary-button'} type="button">
              {item.owned ? 'Owned' : `${formatNumber(item.price)} coins`}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
