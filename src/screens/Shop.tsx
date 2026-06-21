import { useState } from 'react';
import { shopItems } from '../data/gameData';
import type { PlayerProfile } from '../types/game';
import { formatNumber } from '../utils/format';
import type { ShopActionResult } from '../utils/progression';
import { ScreenHeader } from '../components/ScreenHeader';

type ShopProps = {
  profile: PlayerProfile;
  onPurchaseItem: (itemId: string) => ShopActionResult;
};

function getPowerUpAssetPath(powerUpId: string): string {
  return `/assets/icons/powerup-${powerUpId}.png`;
}

export function Shop({ profile, onPurchaseItem }: ShopProps) {
  const [shopMessage, setShopMessage] = useState('');

  const handleShopResult = (result: ShopActionResult) => {
    setShopMessage(result.message);
  };

  return (
    <section className="screen">
      <ScreenHeader title="Travel Gear Shop" subtitle="Stock up on power-ups before your next memory route." />
      <div className="shop-wallet">
        <span className="eyebrow">Your Coins</span>
        <strong>{formatNumber(profile.coins)}</strong>
      </div>
      {shopMessage ? <div className="shop-message" role="status">{shopMessage}</div> : null}
      <div className="shop-grid">
        {shopItems.map((item) => {
          const quantity = profile.powerUpInventory[item.id] ?? 0;

          return (
            <article className="shop-card" key={item.id}>
              <div className="shop-token shop-token-travel-gear" aria-hidden="true">
                <img
                  alt=""
                  className="asset-shop-power-up-icon"
                  onLoad={(event) => {
                    const fallbackLabel = event.currentTarget.nextElementSibling;

                    if (fallbackLabel instanceof HTMLElement) {
                      fallbackLabel.style.display = 'none';
                    }
                  }}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                  src={getPowerUpAssetPath(item.id)}
                />
                <span>{item.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="shop-card-badges">
                <span className="badge">{item.rarity}</span>
                <span className="badge premium-badge">Owned: {quantity}</span>
              </div>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <button
                className="primary-button"
                onClick={() => handleShopResult(onPurchaseItem(item.id))}
                type="button"
              >
                Buy for {formatNumber(item.price)} coins
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
