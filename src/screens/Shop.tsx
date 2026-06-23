import { useState } from 'react';
import { shopItems } from '../data/gameData';
import type { PlayerProfile } from '../types/game';
import { formatNumber } from '../utils/format';
import type { ShopActionResult } from '../utils/progression';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../i18n/useLanguage';

type ShopProps = {
  profile: PlayerProfile;
  onPurchaseItem: (itemId: string) => ShopActionResult;
};

function getPowerUpAssetPath(powerUpId: string): string {
  return `/assets/icons/powerup-${powerUpId}.png`;
}

export function Shop({ profile, onPurchaseItem }: ShopProps) {
  const [shopMessage, setShopMessage] = useState('');
  const { t } = useLanguage();

  const handleShopResult = (result: ShopActionResult) => {
    setShopMessage(result.message);
  };

  return (
    <section className="screen">
      <ScreenHeader title={t('shop.title')} subtitle={t('shop.subtitle')} />
      <div className="shop-wallet">
        <span className="eyebrow">{t('shop.yourCoins')}</span>
        <strong>{formatNumber(profile.coins)}</strong>
      </div>
      {shopMessage ? <div className="shop-message" role="status">{shopMessage}</div> : null}
      <div className="shop-grid">
        {shopItems.map((item) => {
          const quantity = profile.powerUpInventory[item.id] ?? 0;
          const itemName = t(`shopItems.${item.id}.name`);

          return (
            <article className="shop-card" key={item.id}>
              <div className="shop-token shop-token-travel-gear" aria-hidden="true">
                <img
                  alt=""
                  className="asset-shop-power-up-icon"
                  decoding="async"
                  loading="lazy"
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
                <span>{itemName.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="shop-card-badges">
                <span className="badge">{t(`rarity.${item.rarity}`)}</span>
                <span className="badge premium-badge">{t('common.owned', { quantity })}</span>
              </div>
              <h2>{itemName}</h2>
              <p>{t(`shopItems.${item.id}.description`)}</p>
              <button
                className="primary-button"
                onClick={() => handleShopResult(onPurchaseItem(item.id))}
                type="button"
              >
                {t('common.buyFor', { price: formatNumber(item.price) })}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
