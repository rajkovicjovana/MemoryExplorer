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
const musicMuteStorageKey = 'memory-explorer-music-muted';
const audioBasePath = '/assets/audio/';
const audioCache = new Map<SoundId, HTMLAudioElement>();
const lastPlayedAt = new Map<SoundId, number>();
let backgroundMusic: HTMLAudioElement | null = null;
let audioUnlocked = false;
let audioPreloaded = false;

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

export function isMusicMuted(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(musicMuteStorageKey) === 'true';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(muteStorageKey, String(muted));
  window.dispatchEvent(new CustomEvent('memory-explorer-audio-muted-change', { detail: muted }));
}

export function setMusicMuted(muted: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(musicMuteStorageKey, String(muted));
  window.dispatchEvent(new CustomEvent('memory-explorer-music-muted-change', { detail: muted }));

  if (muted) {
    pauseBackgroundMusic();
  } else {
    playBackgroundMusic();
  }
}

export function toggleAudioMuted(): boolean {
  const nextMuted = !isAudioMuted();

  setAudioMuted(nextMuted);

  return nextMuted;
}

export function toggleMusicMuted(): boolean {
  const nextMuted = !isMusicMuted();

  setMusicMuted(nextMuted);

  return nextMuted;
}

export function unlockAudio(): void {
  if (audioUnlocked) {
    playBackgroundMusic();
    return;
  }

  audioUnlocked = true;
  preloadAudio();
  playBackgroundMusic();
}

function preloadAudio(): void {
  if (audioPreloaded) {
    return;
  }

  audioPreloaded = true;
  preloadSoundIds.forEach((soundId) => {
    try {
      getAudio(soundId)?.load();
    } catch {
      // Preload is best-effort only.
    }
  });

  try {
    getBackgroundMusic();
  } catch {
    // Music preload is best-effort only.
  }
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

function getBackgroundMusic(): HTMLAudioElement | null {
  if (!canUseAudio()) {
    return null;
  }

  if (backgroundMusic) {
    return backgroundMusic;
  }

  backgroundMusic = new Audio(`${audioBasePath}background-music.mp3`);
  backgroundMusic.loop = true;
  backgroundMusic.preload = 'auto';
  backgroundMusic.volume = 0.2;

  return backgroundMusic;
}

function pauseBackgroundMusic(): void {
  try {
    backgroundMusic?.pause();
  } catch {
    // Music is best-effort only.
  }
}

export function playBackgroundMusic(): void {
  if (isMusicMuted() || !audioUnlocked) {
    return;
  }

  const music = getBackgroundMusic();

  if (!music || !music.paused) {
    return;
  }

  try {
    music.volume = 0.2;
    void music.play().catch(() => {
      // Missing files and browser autoplay rejections should never affect gameplay.
    });
  } catch {
    // Music is best-effort only.
  }
}

export function playSound(soundId: SoundId, volume = 0.72): void {
  if (isAudioMuted() || !audioUnlocked) {
    return;
  }

  const now = Date.now();
  const minimumGapMs = soundId === 'button-click' ? 25 : 0;

  if (minimumGapMs > 0 && now - (lastPlayedAt.get(soundId) ?? 0) < minimumGapMs) {
    return;
  }

  const sourceAudio = getAudio(soundId);

  if (!sourceAudio) {
    return;
  }

  try {
    lastPlayedAt.set(soundId, now);
    const audio = sourceAudio.cloneNode(true) as HTMLAudioElement;
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
