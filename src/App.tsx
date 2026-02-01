import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { calculateWinRate, type Card, type Rank, type Suit, suitColorClass, suitToSymbol } from './lib/poker'

const RANK_KEYS = new Set(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'])

type CardSlot = Card | null

type CardInputGridProps = {
  id: string
  label: string
  cards: CardSlot[]
  onSetCard: (index: number, card: Card) => boolean
  onClearCard: (index: number) => void
  activeInputId: string | null
  setActiveInputId: (id: string) => void
  onError: (message: string) => void
}

function CardInputGrid({
  id,
  label,
  cards,
  onSetCard,
  onClearCard,
  activeInputId,
  setActiveInputId,
  onError,
}: CardInputGridProps) {
  const [selectedSuit, setSelectedSuit] = useState<Suit | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [pendingTen, setPendingTen] = useState(false)
  const isActive = activeInputId === id

  useEffect(() => {
    if (!isActive) return
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Tab') return

      if (event.key === 'Backspace' || event.key === 'Delete') {
        onClearCard(activeIndex)
        setPendingTen(false)
        return
      }

      let rank: Rank | null = null
      const key = event.key.toUpperCase()

      if (key === '1') {
        setPendingTen(true)
        return
      }

      if (pendingTen && key === '0') {
        rank = 'T'
        setPendingTen(false)
      } else if (RANK_KEYS.has(key)) {
        rank = key as Rank
        setPendingTen(false)
      } else {
        setPendingTen(false)
      }

      if (!rank) return
      if (!selectedSuit) {
        onError('Select a suit first.')
        return
      }

      const index = cards[activeIndex] ? nextEmptyIndex(cards) : activeIndex
      if (index === -1) return
      const nextCards = [...cards]
      nextCards[index] = { rank, suit: selectedSuit }
      const ok = onSetCard(index, { rank, suit: selectedSuit })
      if (ok) {
        const next = nextEmptyIndex(nextCards)
        if (next !== -1) setActiveIndex(next)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeIndex, cards, isActive, onClearCard, onError, onSetCard, pendingTen, selectedSuit])

  return (
    <section className={`card-panel ${isActive ? 'active' : ''}`} onClick={() => setActiveInputId(id)}>
      <div className="panel-header">
        <div className="panel-title">{label}</div>
        <div className="suit-selector" role="group" aria-label="Suit selector">
          {(['s', 'h', 'd', 'c'] as Suit[]).map((suit) => (
            <button
              key={suit}
              type="button"
              className={`suit-button ${selectedSuit === suit ? 'selected' : ''} ${suitColorClass(suit)}`}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedSuit(suit)
                setActiveInputId(id)
              }}
            >
              {suitToSymbol(suit)}
            </button>
          ))}
        </div>
      </div>
      <div className="slot-grid">
        {cards.map((card, index) => (
          <button
            key={`${label}-${index}`}
            type="button"
            className={`card-slot ${index === activeIndex ? 'slot-active' : ''} ${card ? suitColorClass(card.suit) : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              setActiveIndex(index)
              setActiveInputId(id)
            }}
            aria-label={`${label} card ${index + 1}`}
          >
            {card ? (
              <span className="card-value">
                {card.rank}
                {suitToSymbol(card.suit)}
              </span>
            ) : (
              <span className="card-placeholder">—</span>
            )}
          </button>
        ))}
      </div>
      <div className="panel-hint">Click a suit, then type the rank. Use Backspace to clear.</div>
    </section>
  )
}

function nextEmptyIndex(cards: CardSlot[]): number {
  return cards.findIndex((card) => !card)
}

function compactCards(cards: CardSlot[]): Card[] {
  return cards.filter((card): card is Card => Boolean(card))
}

function toKey(card: Card): string {
  return `${card.rank}${card.suit}`
}

function App() {
  const [numPlayers, setNumPlayers] = useState(6)
  const [knownOpponentsCount, setKnownOpponentsCount] = useState(0)
  const [heroCards, setHeroCards] = useState<CardSlot[]>([null, null])
  const [boardCards, setBoardCards] = useState<CardSlot[]>([null, null, null, null, null])
  const [knownOpponents, setKnownOpponents] = useState<CardSlot[][]>([])
  const [activeInputId, setActiveInputId] = useState<string | null>('hero')
  const [error, setError] = useState<string>('')
  const [equity, setEquity] = useState<number | null>(null)
  const [iterations, setIterations] = useState(0)
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    setKnownOpponents((prev) => {
      const next = [...prev]
      while (next.length < knownOpponentsCount) next.push([null, null])
      while (next.length > knownOpponentsCount) next.pop()
      return next
    })
  }, [knownOpponentsCount])

  useEffect(() => {
    setKnownOpponentsCount((count) => Math.min(count, numPlayers - 1))
  }, [numPlayers])

  const allCards = useMemo(() => {
    return [...compactCards(heroCards), ...compactCards(boardCards), ...knownOpponents.flatMap(compactCards)]
  }, [heroCards, boardCards, knownOpponents])

  const usedKeys = useMemo(() => new Set(allCards.map(toKey)), [allCards])

  const canCalculate = useMemo(() => {
    if (compactCards(heroCards).length !== 2) return false
    if (knownOpponents.some((hand) => compactCards(hand).length !== 2)) return false
    return true
  }, [heroCards, knownOpponents])

  useEffect(() => {
    if (!canCalculate) {
      setEquity(null)
      return
    }

    setIsCalculating(true)
    const timer = setTimeout(() => {
      const result = calculateWinRate({
        hero: compactCards(heroCards),
        board: compactCards(boardCards),
        numPlayers,
        knownOpponents: knownOpponents.map(compactCards),
        iterations: 5000,
      })
      setEquity(result.equity)
      setIterations(result.iterations)
      setIsCalculating(false)
    }, 200)

    return () => clearTimeout(timer)
  }, [boardCards, canCalculate, heroCards, knownOpponents, numPlayers])

  const handleHeroSet = (index: number, card: Card) => {
    const nextHero = [...heroCards]
    nextHero[index] = card
    const nextAll = [...compactCards(nextHero), ...compactCards(boardCards), ...knownOpponents.flatMap(compactCards)]
    if (hasDuplicate(nextAll)) {
      setError('Duplicate card detected.')
      return false
    }
    setError('')
    setHeroCards(nextHero)
    return true
  }

  const handleBoardSet = (index: number, card: Card) => {
    const nextBoard = [...boardCards]
    nextBoard[index] = card
    const nextAll = [...compactCards(heroCards), ...compactCards(nextBoard), ...knownOpponents.flatMap(compactCards)]
    if (hasDuplicate(nextAll)) {
      setError('Duplicate card detected.')
      return false
    }
    setError('')
    setBoardCards(nextBoard)
    return true
  }

  const handleOpponentSet = (handIndex: number, cardIndex: number, card: Card) => {
    const nextOpponents = knownOpponents.map((hand) => [...hand])
    nextOpponents[handIndex][cardIndex] = card
    const nextAll = [...compactCards(heroCards), ...compactCards(boardCards), ...nextOpponents.flatMap(compactCards)]
    if (hasDuplicate(nextAll)) {
      setError('Duplicate card detected.')
      return false
    }
    setError('')
    setKnownOpponents(nextOpponents)
    return true
  }

  const handleClearHero = (index: number) => {
    const next = [...heroCards]
    next[index] = null
    setHeroCards(next)
    setError('')
  }

  const handleClearBoard = (index: number) => {
    const next = [...boardCards]
    next[index] = null
    setBoardCards(next)
    setError('')
  }

  const handleClearOpponent = (handIndex: number, cardIndex: number) => {
    setKnownOpponents((prev) => {
      const next = prev.map((hand) => [...hand])
      next[handIndex][cardIndex] = null
      return next
    })
    setError('')
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-title">FlopLab</div>
        <p className="hero-subtitle">Fast Texas Hold'em win-rate calculator with suit-first input.</p>
      </header>

      <section className="settings">
        <div className="setting">
          <label htmlFor="players">Players</label>
          <input
            id="players"
            type="number"
            min={2}
            max={9}
            value={numPlayers}
            onChange={(event) => setNumPlayers(Math.min(9, Math.max(2, Number(event.target.value))))}
          />
        </div>
        <div className="setting">
          <label htmlFor="knownOpponents">Known Opponents</label>
          <input
            id="knownOpponents"
            type="number"
            min={0}
            max={numPlayers - 1}
            value={knownOpponentsCount}
            onChange={(event) => setKnownOpponentsCount(Math.min(numPlayers - 1, Math.max(0, Number(event.target.value))))}
          />
        </div>
        <div className="setting info">
          <div className="info-label">Status</div>
          <div className="info-value">
            {error ? error : isCalculating ? 'Calculating…' : equity !== null ? 'Ready' : 'Waiting for hole cards'}
          </div>
        </div>
      </section>

      <CardInputGrid
        id="hero"
        label="Your Hand"
        cards={heroCards}
        onSetCard={handleHeroSet}
        onClearCard={handleClearHero}
        activeInputId={activeInputId}
        setActiveInputId={setActiveInputId}
        onError={setError}
      />

      <CardInputGrid
        id="board"
        label="Board (Flop → Turn → River)"
        cards={boardCards}
        onSetCard={handleBoardSet}
        onClearCard={handleClearBoard}
        activeInputId={activeInputId}
        setActiveInputId={setActiveInputId}
        onError={setError}
      />

      {knownOpponents.map((hand, index) => (
        <CardInputGrid
          key={`opponent-${index}`}
          id={`opponent-${index}`}
          label={`Known Opponent ${index + 1}`}
          cards={hand}
          onSetCard={(cardIndex, card) => handleOpponentSet(index, cardIndex, card)}
          onClearCard={(cardIndex) => handleClearOpponent(index, cardIndex)}
          activeInputId={activeInputId}
          setActiveInputId={setActiveInputId}
          onError={setError}
        />
      ))}

      <section className="results">
        <div className="result-card">
          <div className="result-label">Win Rate (Equity)</div>
          <div className="result-value">
            {equity === null ? '—' : `${(equity * 100).toFixed(2)}%`}
          </div>
          <div className="result-meta">
            {equity === null ? 'Enter your two hole cards to start.' : `Monte Carlo ${iterations.toLocaleString()} iterations`}
          </div>
        </div>
        <div className="result-card">
          <div className="result-label">Cards Used</div>
          <div className="result-meta">{usedKeys.size} / 52</div>
        </div>
      </section>
    </div>
  )
}

function hasDuplicate(cards: Card[]): boolean {
  const seen = new Set<string>()
  for (const card of cards) {
    const key = toKey(card)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export default App
