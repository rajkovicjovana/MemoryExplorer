import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLanguage } from '../i18n/useLanguage';
import type { ScreenId, World } from '../types/game';

type QuestionCard = {
  id: string;
  symbol: string;
  label: string;
  assetPath: string;
};

type QuestionsPlayer = {
  id: number;
  playerIndex: number;
  name: string;
  score: number;
  correct: number;
  totalTimeMs: number;
};

type SingleQuestion = {
  id: string;
  playerIndex: number;
  difficulty: 'easy' | 'medium';
  points: number;
  prompt: string;
  correctCards: QuestionCard[];
  options: QuestionCard[];
  kind: 'single';
};

type SequenceQuestion = {
  id: string;
  playerIndex: number;
  difficulty: 'hard';
  points: number;
  prompt: string;
  correctCards: QuestionCard[];
  options: QuestionCard[];
  kind: 'sequence';
};

type QuestionsModeQuestion = SingleQuestion | SequenceQuestion;

type AnswerFeedback = {
  correct: boolean;
  question: QuestionsModeQuestion;
  selectedCards: QuestionCard[];
};

type QuestionsModeSessionProps = {
  world: World;
  onNavigate: (screen: ScreenId) => void;
  onRegisterExitHandler: (handler: ((screen: ScreenId) => void) | null) => void;
  onRestart: () => void;
};

type RevealState = {
  activeRowIndex: number;
  timeLeft: number;
  isComplete: boolean;
};

const rowMemorizeSeconds = 10;
const boardRowIndexes = [0, 1, 2, 3] as const;
const playerIndexes = [0, 1, 2, 3] as const;
const defaultQuestionPlayers = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const initialRevealState: RevealState = {
  activeRowIndex: 0,
  timeLeft: rowMemorizeSeconds,
  isComplete: false,
};

function getBoardRowIndex(rowIndex: number): number {
  return Math.min(Math.max(rowIndex, 0), boardRowIndexes.length - 1);
}

function getBoardRowLabel(rowIndex: number): string {
  return `Row ${getBoardRowIndex(rowIndex) + 1}`;
}

function getDefaultPlayerName(playerIndex: number): string {
  return defaultQuestionPlayers[playerIndex] ?? `Player ${playerIndex + 1}`;
}

function getPlayerName(players: QuestionsPlayer[], playerIndex: number): string {
  return players[playerIndex]?.name ?? getDefaultPlayerName(playerIndex);
}

function getPlayerLabel(players: QuestionsPlayer[], playerIndex: number): string {
  const defaultName = getDefaultPlayerName(playerIndex);
  const playerName = getPlayerName(players, playerIndex);

  return playerName === defaultName ? defaultName : `${defaultName}: ${playerName}`;
}

function createQuestionPlayers(names: string[]): QuestionsPlayer[] {
  return playerIndexes.map((playerIndex) => ({
    id: playerIndex + 1,
    playerIndex,
    name: names[playerIndex] ?? getDefaultPlayerName(playerIndex),
    score: 0,
    correct: 0,
    totalTimeMs: 0,
  }));
}

const mountainCardAssetPaths: Record<string, string> = {
  Peak: '/assets/cards/mountain-1.png',
  Cabin: '/assets/cards/mountain-2.png',
  Compass: '/assets/cards/mountain-3.png',
  Pine: '/assets/cards/mountain-4.png',
  Glacier: '/assets/cards/mountain-5.png',
  Eagle: '/assets/cards/mountain-6.png',
  Campfire: '/assets/cards/mountain-7.png',
  Backpack: '/assets/cards/mountain-8.png',
  Waterfall: '/assets/cards/mountain-9.png',
  'Rope Bridge': '/assets/cards/mountain-10.png',
  Snowboard: '/assets/cards/mountain-11.png',
  Lake: '/assets/cards/mountain-12.png',
  Ibex: '/assets/cards/mountain-13.png',
  Tent: '/assets/cards/mountain-14.png',
  Map: '/assets/cards/mountain-15.png',
  'Hot Spring': '/assets/cards/mountain-16.png',
  'Summit Flag': '/assets/cards/mountain-17.png',
  Lantern: '/assets/cards/mountain-18.png',
  'Ridge Trail': '/assets/cards/mountain-19.png',
  'Alpine Dawn': '/assets/cards/mountain-20.png',
  'High Valley': '/assets/cards/mountain-21.png',
  'Stone Chalet': '/assets/cards/mountain-22.png',
  'Sky Vista': '/assets/cards/mountain-23.png',
  'Canyon Pass': '/assets/cards/mountain-24.png',
};

const tropicalCardAssetPaths: Record<string, string> = {
  Lagoon: '/assets/cards/tropical-1.png',
  Bungalow: '/assets/cards/tropical-2.png',
  Sail: '/assets/cards/tropical-3.png',
  Reef: '/assets/cards/tropical-4.png',
  Sunset: '/assets/cards/tropical-5.png',
  Cove: '/assets/cards/tropical-6.png',
};

function getWorldAssetId(worldId: string): string {
  if (worldId === 'tropics') {
    return 'tropical';
  }

  if (worldId === 'mountains') {
    return 'mountain';
  }

  return worldId;
}

function getCardFaceAssetPath(world: World, symbol: string): string {
  if (world.id === 'mountains') {
    return mountainCardAssetPaths[symbol] ?? `/assets/cards/mountain-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  }

  if (world.id === 'tropics' && tropicalCardAssetPaths[symbol]) {
    return tropicalCardAssetPaths[symbol];
  }

  const worldAssetId = getWorldAssetId(world.id);
  const symbolAssetId = symbol.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `/assets/cards/${worldAssetId}-${symbolAssetId}.png`;
}

function shuffleItems<T>(items: T[]): T[] {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function makeLabel(symbol: string, index: number): string {
  const initials = symbol
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return initials || `C${index + 1}`;
}

function buildQuestionBoard(world: World): QuestionCard[][] {
  const uniqueSymbols = Array.from(new Set(world.sampleCardSymbols));
  const symbols = uniqueSymbols.length >= 16
    ? shuffleItems(uniqueSymbols).slice(0, 16)
    : Array.from({ length: 16 }, (_, index) => uniqueSymbols[index % uniqueSymbols.length] ?? `Card ${index + 1}`);
  const cards = symbols.map((symbol, index) => ({
    id: `${world.id}-questions-${symbol}-${index}`,
    symbol,
    label: makeLabel(symbol, index),
    assetPath: getCardFaceAssetPath(world, symbol),
  }));

  return boardRowIndexes.map((rowIndex) => cards.slice(rowIndex * 4, rowIndex * 4 + 4));
}

function makeSingleOptions(correctCard: QuestionCard, allCards: QuestionCard[]): QuestionCard[] {
  const distractors = shuffleItems(allCards.filter((card) => card.id !== correctCard.id)).slice(0, 3);

  return shuffleItems([correctCard, ...distractors]);
}

function positionName(position: number): string {
  if (position === 0) {
    return 'first position';
  }

  if (position === 3) {
    return 'last position';
  }

  return `position ${position + 1}`;
}

function buildQuestions(board: QuestionCard[][], playerNames: string[]): QuestionsModeQuestion[] {
  const allCards = board.flat();
  const questions: QuestionsModeQuestion[] = [];

  playerIndexes.forEach((playerIndex) => {
    const row = board[playerIndex] ?? [];
    const ownerName = playerNames[playerIndex] ?? getDefaultPlayerName(playerIndex);
    const easyPosition = playerIndex % 4;
    const easyCorrect = row[easyPosition] ?? row[0];
    const targetPlayerIndex = (playerIndex + 1) % 4;
    const targetName = playerNames[targetPlayerIndex] ?? getDefaultPlayerName(targetPlayerIndex);
    const mediumPosition = (playerIndex + 2) % 4;
    const mediumCorrect = board[targetPlayerIndex]?.[mediumPosition] ?? row[0];
    const hardTargetPlayerIndex = (playerIndex + 2) % 4;
    const hardTargetName = playerNames[hardTargetPlayerIndex] ?? getDefaultPlayerName(hardTargetPlayerIndex);
    const hardCorrectCards = board[hardTargetPlayerIndex] ?? row;

    questions.push({
      id: `p${playerIndex + 1}-easy`,
      playerIndex,
      difficulty: 'easy',
      points: 10,
      kind: 'single',
      prompt: `Which card was in ${positionName(easyPosition)} of ${ownerName}'s row?`,
      correctCards: [easyCorrect],
      options: makeSingleOptions(easyCorrect, allCards),
    });

    questions.push({
      id: `p${playerIndex + 1}-medium`,
      playerIndex,
      difficulty: 'medium',
      points: 20,
      kind: 'single',
      prompt: `Which card was in ${positionName(mediumPosition)} of ${targetName}'s row?`,
      correctCards: [mediumCorrect],
      options: makeSingleOptions(mediumCorrect, allCards),
    });

    questions.push({
      id: `p${playerIndex + 1}-hard`,
      playerIndex,
      difficulty: 'hard',
      points: 40,
      kind: 'sequence',
      prompt: `Choose the cards from ${hardTargetName}'s row in the correct order.`,
      correctCards: hardCorrectCards,
      options: shuffleItems(allCards),
    });
  });

  return questions;
}

function cardsMatchInOrder(selectedCards: QuestionCard[], correctCards: QuestionCard[]): boolean {
  return selectedCards.length === correctCards.length && selectedCards.every((card, index) => card.id === correctCards[index]?.id);
}

function formatAnswerTime(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function resolveWinner(players: QuestionsPlayer[]): QuestionsPlayer {
  return [...players].sort((firstPlayer, secondPlayer) => {
    if (secondPlayer.score !== firstPlayer.score) {
      return secondPlayer.score - firstPlayer.score;
    }

    return firstPlayer.totalTimeMs - secondPlayer.totalTimeMs;
  })[0] ?? players[0];
}

function normalizePlayerNames(names: string[]): string[] {
  return playerIndexes.map((playerIndex) => {
    const defaultName = getDefaultPlayerName(playerIndex);
    const name = names[playerIndex]?.trim().replace(/\s+/g, ' ').slice(0, 18);

    return name && name.length > 0 ? name : defaultName;
  });
}

function QuestionCardButton({
  card,
  disabled = false,
  isSelected = false,
  onClick,
}: {
  card: QuestionCard;
  disabled?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={card.symbol}
      className={isSelected ? 'question-card-option selected' : 'question-card-option'}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <img
        alt=""
        decoding="async"
        draggable={false}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
        src={card.assetPath}
      />
    </button>
  );
}

export function QuestionsModeSession({ world, onNavigate, onRegisterExitHandler, onRestart }: QuestionsModeSessionProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<'setup' | 'memorize' | 'quiz' | 'feedback' | 'results'>('setup');
  const [revealState, setRevealState] = useState<RevealState>(initialRevealState);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedCards, setSelectedCards] = useState<QuestionCard[]>([]);
  const [playerNameInputs, setPlayerNameInputs] = useState(defaultQuestionPlayers);
  const [players, setPlayers] = useState<QuestionsPlayer[]>(() => createQuestionPlayers(defaultQuestionPlayers));
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const questionStartedAtRef = useRef<number>(0);
  const revealTimerRef = useRef<number | null>(null);

  const board = useMemo(() => buildQuestionBoard(world), [world]);
  const playerNameKey = players.map((player) => player.name).join('|');
  const playerNames = useMemo(() => playerNameKey.split('|'), [playerNameKey]);
  const questions = useMemo(() => buildQuestions(board, playerNames), [board, playerNames]);
  const currentQuestion = questions[questionIndex];

  const winner = useMemo(() => resolveWinner(players), [players]);
  const activeBoardRowIndex = getBoardRowIndex(revealState.activeRowIndex);
  const activeRowLabel = getBoardRowLabel(activeBoardRowIndex);
  const activeRowPlayerLabel = getPlayerLabel(players, activeBoardRowIndex);
  const timeLeft = revealState.timeLeft;
  const boardStyle = {
    '--board-columns': 4,
    '--world-primary': world.theme.primary,
    '--world-secondary': world.theme.secondary,
    '--world-accent': world.theme.accent,
  } as CSSProperties;


  const requestExit = useCallback((screen: ScreenId) => {
    onNavigate(screen);
  }, [onNavigate]);

  useEffect(() => {
    if (phase === 'results') {
      onRegisterExitHandler(null);
      return undefined;
    }

    onRegisterExitHandler(requestExit);

    return () => onRegisterExitHandler(null);
  }, [onRegisterExitHandler, phase, requestExit]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'memorize') {
      clearRevealTimer();
      return undefined;
    }

    clearRevealTimer();
    revealTimerRef.current = window.setInterval(() => {
      setRevealState((currentRevealState) => {
        if (currentRevealState.isComplete) {
          return currentRevealState;
        }

        if (currentRevealState.timeLeft > 1) {
          return {
            ...currentRevealState,
            timeLeft: currentRevealState.timeLeft - 1,
          };
        }

        if (currentRevealState.activeRowIndex < boardRowIndexes.length - 1) {
          return {
            activeRowIndex: currentRevealState.activeRowIndex + 1,
            timeLeft: rowMemorizeSeconds,
            isComplete: false,
          };
        }

        return {
          activeRowIndex: boardRowIndexes.length - 1,
          timeLeft: 0,
          isComplete: true,
        };
      });
    }, 1000);

    return clearRevealTimer;
  }, [clearRevealTimer, phase]);

  useEffect(() => {
    if (phase !== 'memorize' || !revealState.isComplete) {
      return;
    }

    clearRevealTimer();
    questionStartedAtRef.current = Date.now();
    setPhase('quiz');
  }, [clearRevealTimer, phase, revealState.isComplete]);

  const startQuestionsMode = () => {
    const names = normalizePlayerNames(playerNameInputs);

    setPlayerNameInputs(names);
    setPlayers(createQuestionPlayers(names));
    setRevealState(initialRevealState);
    setQuestionIndex(0);
    setSelectedCards([]);
    setFeedback(null);
    setPhase('memorize');
  };

  const submitAnswer = useCallback((answerCards: QuestionCard[]) => {
    if (!currentQuestion || phase !== 'quiz') {
      return;
    }

    const answerTime = Date.now() - questionStartedAtRef.current;
    const isCorrect = cardsMatchInOrder(answerCards, currentQuestion.correctCards);

    setPlayers((currentPlayers) => currentPlayers.map((player) => {
      if (player.playerIndex !== currentQuestion.playerIndex) {
        return player;
      }

      return {
        ...player,
        score: player.score + (isCorrect ? currentQuestion.points : 0),
        correct: player.correct + (isCorrect ? 1 : 0),
        totalTimeMs: player.totalTimeMs + answerTime,
      };
    }));

    setFeedback({ correct: isCorrect, question: currentQuestion, selectedCards: answerCards });
    setPhase('feedback');
  }, [currentQuestion, phase]);

  const handleHardCardSelect = (card: QuestionCard) => {
    if (!currentQuestion || currentQuestion.kind !== 'sequence' || phase !== 'quiz') {
      return;
    }

    setSelectedCards((currentSelection) => {
      if (currentSelection.some((selectedCard) => selectedCard.id === card.id)) {
        return currentSelection.filter((selectedCard) => selectedCard.id !== card.id);
      }

      if (currentSelection.length >= currentQuestion.correctCards.length) {
        return currentSelection;
      }

      return [...currentSelection, card];
    });
  };

  const continueAfterFeedback = () => {
    const nextQuestionIndex = questionIndex + 1;

    setSelectedCards([]);
    setFeedback(null);

    if (nextQuestionIndex >= questions.length) {
      setPlayers((currentPlayers) => currentPlayers.map((player) => ({
        ...player,
        score: player.score + (player.correct === 3 ? 20 : 0),
      })));
      setPhase('results');
      return;
    }

    setQuestionIndex(nextQuestionIndex);
    questionStartedAtRef.current = Date.now();
    setPhase('quiz');
  };

  return (
    <section className="screen gameplay-screen questions-screen">
      <ScreenHeader
        title={t('modes.questions.name')}
        subtitle={t('modes.questions.description')}
        action={<button className="small-button" onClick={() => onNavigate('mode-select')} type="button">{t('common.modes')}</button>}
      />

      <div className="gameplay-shell questions-shell" style={boardStyle}>
        <div className="game-status-ribbon">
          <span className="badge destination-badge">{t(`worlds.${world.id}.name`)}</span>
          <span className="badge">4 Players</span>
          <span className={phase === 'memorize' ? 'badge timer-badge' : 'badge'}>
            {phase === 'setup'
              ? 'Setup'
              : phase === 'memorize'
                ? `${activeRowLabel}: ${timeLeft}s`
                : phase === 'results' ? 'Results' : `Question ${questionIndex + 1}/12`}
          </span>
        </div>

        {phase === 'setup' ? (
          <div className="questions-setup-panel">
            <span className="eyebrow">Players</span>
            <h2>Name the local players</h2>
            <div className="questions-name-grid">
              {playerIndexes.map((playerIndex) => {
                const name = playerNameInputs[playerIndex] ?? getDefaultPlayerName(playerIndex);

                return (
                  <label key={getDefaultPlayerName(playerIndex)}>
                    <span>{getDefaultPlayerName(playerIndex)}</span>
                    <input
                      maxLength={18}
                      onChange={(event) => {
                        const nextNames = [...playerNameInputs];
                        nextNames[playerIndex] = event.target.value;
                        setPlayerNameInputs(nextNames);
                      }}
                      placeholder={getDefaultPlayerName(playerIndex)}
                      type="text"
                      value={name}
                    />
                  </label>
                );
              })}
            </div>
            <button className="primary-button wide" onClick={startQuestionsMode} type="button">Start Memorizing</button>
          </div>
        ) : null}

        {phase !== 'setup' ? (
          <div className="questions-player-strip">
            {players.map((player) => (
              <span
                className={
                  (phase === 'memorize' && activeBoardRowIndex === player.playerIndex) ||
                  (currentQuestion?.playerIndex === player.playerIndex && phase !== 'results')
                    ? 'active'
                    : ''
                }
                key={player.id}
              >
                <strong>{getPlayerLabel(players, player.playerIndex)}</strong>
                {player.score} pts
              </span>
            ))}
          </div>
        ) : null}

        {phase !== 'setup' ? (
          <div className="memory-grid playable-board questions-board" role="grid">
            {boardRowIndexes.map((rowIndex) => (board[rowIndex] ?? []).map((card) => {
              const isVisible = phase === 'memorize' && rowIndex === activeBoardRowIndex;

              return (
                <div className={isVisible ? 'memory-card playable flipped questions-board-card' : 'memory-card playable questions-board-card'} key={card.id} role="gridcell">
                  <span className="card-inner">
                    {isVisible ? (
                      <span className="card-face card-front image-loaded questions-clean-front">
                        <img alt="" className="asset-card-face" draggable={false} src={card.assetPath} />
                      </span>
                    ) : (
                      <span className="card-face card-back questions-card-back"><span>{getBoardRowIndex(rowIndex) + 1}</span></span>
                    )}
                  </span>
                </div>
              );
            }))}
          </div>
        ) : null}

        {phase === 'memorize' ? (
          <div className="questions-prompt-panel">
            <span className="eyebrow">Memorize {activeRowLabel} - {getDefaultPlayerName(activeBoardRowIndex)}</span>
            <h2>{activeRowPlayerLabel}'s row - memorize these cards</h2>
            <p>Only this row is visible. The next row appears after the timer ends.</p>
          </div>
        ) : null}

        {phase === 'quiz' && currentQuestion ? (
          <div className="questions-prompt-panel">
            <span className="eyebrow">{getPlayerLabel(players, currentQuestion.playerIndex)} - {currentQuestion.difficulty}</span>
            <h2>{currentQuestion.prompt}</h2>
            {currentQuestion.kind === 'single' ? (
              <div className="question-option-grid">
                {currentQuestion.options.map((card) => (
                  <QuestionCardButton card={card} key={card.id} onClick={() => submitAnswer([card])} />
                ))}
              </div>
            ) : (
              <>
                <div className="question-sequence-tray">
                  {currentQuestion.correctCards.map((card, index) => {
                    const selectedCard = selectedCards[index];

                    return (
                      <span className={selectedCard ? 'filled' : ''} key={`${card.id}-slot`}>
                        {selectedCard ? <img alt="" draggable={false} src={selectedCard.assetPath} /> : index + 1}
                      </span>
                    );
                  })}
                </div>
                <div className="question-option-grid dense">
                  {currentQuestion.options.map((card) => {
                    const selectedIndex = selectedCards.findIndex((selectedCard) => selectedCard.id === card.id);

                    return (
                      <QuestionCardButton
                        card={card}
                        isSelected={selectedIndex >= 0}
                        key={card.id}
                        onClick={() => handleHardCardSelect(card)}


                      />
                    );
                  })}
                </div>
                <div className="game-action-row">
                  <button className="secondary-button" onClick={() => setSelectedCards([])} type="button">Clear</button>
                  <button
                    className="primary-button"
                    disabled={selectedCards.length !== currentQuestion.correctCards.length}
                    onClick={() => submitAnswer(selectedCards)}
                    type="button"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {phase === 'feedback' && feedback ? (
          <div className="questions-prompt-panel feedback-panel">
            <span className={feedback.correct ? 'badge timer-badge' : 'badge danger-badge'}>{feedback.correct ? 'Correct' : 'Incorrect'}</span>
            <h2>{getPlayerLabel(players, feedback.question.playerIndex)}</h2>
            <div className="answer-review-grid">
              <div>
                <span className="eyebrow">Player Answer</span>
                <div className="answer-card-row">
                  {feedback.selectedCards.map((card) => <QuestionCardButton card={card} disabled key={card.id} />)}
                </div>
              </div>
              <div>
                <span className="eyebrow">Correct Answer</span>
                <div className="answer-card-row">
                  {feedback.question.correctCards.map((card) => <QuestionCardButton card={card} disabled key={card.id} />)}
                </div>
              </div>
            </div>
            <button className="primary-button wide" onClick={continueAfterFeedback} type="button">
              {questionIndex + 1 >= questions.length ? 'Show Results' : 'Next Question'}
            </button>
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className="questions-prompt-panel results-panel">
            <span className="badge premium-badge">{t('common.winner')}: {getPlayerLabel(players, winner.playerIndex)}</span>
            <h2>Final Results</h2>
            <div className="questions-results-list">
              {[...players]
                .sort((firstPlayer, secondPlayer) => firstPlayer.playerIndex - secondPlayer.playerIndex)
                .map((player) => (
                  <div className={winner.id === player.id ? 'winner' : ''} key={player.id}>
                    <strong>{getPlayerLabel(players, player.playerIndex)}</strong>
                    <span>{player.score} pts</span>
                    <span>{player.correct}/3 correct</span>
                    <span>{formatAnswerTime(player.totalTimeMs)}</span>
                  </div>
                ))}
            </div>
            <div className="game-action-row">
              <button className="secondary-button" onClick={onRestart} type="button">{t('common.restart')}</button>
              <button className="primary-button" onClick={() => onNavigate('mode-select')} type="button">{t('common.backToModes')}</button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

