import type { World } from '../types/game';
import { ScreenHeader } from '../components/ScreenHeader';
import { WorldCard } from '../components/WorldCard';

type WorldSelectProps = {
  availableWorlds: World[];
  selectedWorld: World;
  onSelectWorld: (world: World) => void;
  onContinue: () => void;
};

export function WorldSelect({ availableWorlds, selectedWorld, onSelectWorld, onContinue }: WorldSelectProps) {
  return (
    <section className="screen">
      <ScreenHeader
        title="Choose a World"
        subtitle="Each destination changes the board mood, card symbols, and challenge curve."
        action={<button className="small-button" onClick={onContinue} type="button">Modes</button>}
      />
      <div className="world-list">
        {availableWorlds.map((world) => (
          <WorldCard
            key={world.id}
            onSelect={onSelectWorld}
            selected={selectedWorld.id === world.id}
            world={world}
          />
        ))}
      </div>
    </section>
  );
}
