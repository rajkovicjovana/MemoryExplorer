export type SoundId =
  | 'badge-unlocked'
  | 'button-click'
  | 'card-match'
  | 'combo'
  | 'daily-complete'
  | 'defeat'
  | 'level-up'
  | 'victory'
  | 'world-unlocked';

const muteStorageKey = 'memory-explorer-audio-muted';
const audioBasePath = '/assets/audio/';
const audioCache = new Map<SoundId, HTMLAudioElement>();
const lastPlayedAt = new Map<SoundId, number>();
let audioUnlocked = false;

const preloadSoundIds: SoundId[] = [
  'button-click',
  'card-match',
  'combo',
  'victory',
  'defeat',
  'level-up',
  'world-unlocked',
  'badge-unlocked',
  'daily-complete',
];

function canUseAudio(): boolean {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(muteStorageKey) === 'true';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(muteStorageKey, String(muted));
  window.dispatchEvent(new CustomEvent('memory-explorer-audio-muted-change', { detail: muted }));
}

export function toggleAudioMuted(): boolean {
  const nextMuted = !isAudioMuted();

  setAudioMuted(nextMuted);

  return nextMuted;
}

export function unlockAudio(): void {
  audioUnlocked = true;
  preloadSoundIds.forEach((soundId) => {
    try {
      getAudio(soundId)?.load();
    } catch {
      // Preload is best-effort only.
    }
  });
}

function getAudio(soundId: SoundId): HTMLAudioElement | null {
  if (!canUseAudio()) {
    return null;
  }

  const cachedAudio = audioCache.get(soundId);

  if (cachedAudio) {
    return cachedAudio;
  }

  const audio = new Audio(`${audioBasePath}${soundId}.mp3`);
  audio.preload = 'auto';
  audioCache.set(soundId, audio);

  return audio;
}

export function playSound(soundId: SoundId, volume = 0.72): void {
  if (isAudioMuted() || !audioUnlocked) {
    return;
  }

  const now = Date.now();
  const minimumGapMs = soundId === 'button-click' ? 80 : 0;

  if (minimumGapMs > 0 && now - (lastPlayedAt.get(soundId) ?? 0) < minimumGapMs) {
    return;
  }

  const sourceAudio = getAudio(soundId);

  if (!sourceAudio) {
    return;
  }

  try {
    lastPlayedAt.set(soundId, now);
    const audio = soundId === 'button-click' ? sourceAudio : sourceAudio.cloneNode(true) as HTMLAudioElement;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, volume));
    void audio.play().catch(() => {
      // Missing files and browser autoplay rejections should never affect gameplay.
    });
  } catch {
    // Audio is best-effort only.
  }
}
