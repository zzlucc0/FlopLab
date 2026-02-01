export type Suit = 's' | 'h' | 'd' | 'c'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'
export type Card = { rank: Rank; suit: Suit }

const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

const SUITS: Suit[] = ['s', 'h', 'd', 'c']
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']

export type WinRateParams = {
  hero: Card[]
  board: Card[]
  numPlayers: number
  knownOpponents: Card[][]
  iterations?: number
}

export type WinRateResult = {
  equity: number
  iterations: number
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`
}

export function createDeck(exclude: Card[]): Card[] {
  const used = new Set(exclude.map(cardToString))
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card = { rank, suit }
      if (!used.has(cardToString(card))) deck.push(card)
    }
  }
  return deck
}

export function calculateWinRate({ hero, board, numPlayers, knownOpponents, iterations = 5000 }: WinRateParams): WinRateResult {
  const unknownOpponentsCount = Math.max(numPlayers - 1 - knownOpponents.length, 0)
  let equity = 0

  for (let i = 0; i < iterations; i += 1) {
    const deck = createDeck([...hero, ...board, ...knownOpponents.flat()])

    const unknownOpponents: Card[][] = []
    for (let j = 0; j < unknownOpponentsCount; j += 1) {
      const first = drawRandom(deck)
      const second = drawRandom(deck)
      unknownOpponents.push([first, second])
    }

    const fullBoard = [...board]
    while (fullBoard.length < 5) {
      fullBoard.push(drawRandom(deck))
    }

    const heroRank = evaluate7([...hero, ...fullBoard])
    let bestRank = heroRank
    let winners: number[] = [-1]

    const allOpponents = [...knownOpponents, ...unknownOpponents]
    allOpponents.forEach((hand, index) => {
      const rank = evaluate7([...hand, ...fullBoard])
      const cmp = compareRanks(rank, bestRank)
      if (cmp > 0) {
        bestRank = rank
        winners = [index]
      } else if (cmp === 0) {
        winners.push(index)
      }
    })

    if (winners.includes(-1)) {
      equity += 1 / winners.length
    }
  }

  return { equity: equity / iterations, iterations }
}

function drawRandom(deck: Card[]): Card {
  const idx = Math.floor(Math.random() * deck.length)
  const [card] = deck.splice(idx, 1)
  return card
}

const COMBOS_7_5: number[][] = (() => {
  const combos: number[][] = []
  for (let a = 0; a < 3; a += 1) {
    for (let b = a + 1; b < 4; b += 1) {
      for (let c = b + 1; c < 5; c += 1) {
        for (let d = c + 1; d < 6; d += 1) {
          for (let e = d + 1; e < 7; e += 1) {
            combos.push([a, b, c, d, e])
          }
        }
      }
    }
  }
  return combos
})()

function evaluate7(cards: Card[]): number[] {
  let best = evaluate5(pick(cards, COMBOS_7_5[0]))
  for (let i = 1; i < COMBOS_7_5.length; i += 1) {
    const hand = evaluate5(pick(cards, COMBOS_7_5[i]))
    if (compareRanks(hand, best) > 0) best = hand
  }
  return best
}

function pick(cards: Card[], combo: number[]): Card[] {
  return combo.map((idx) => cards[idx])
}

function evaluate5(cards: Card[]): number[] {
  const ranks = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a)
  const isFlush = cards.every((card) => card.suit === cards[0].suit)

  const counts = new Map<number, number>()
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1)
  }

  const uniqueRanks = Array.from(counts.keys()).sort((a, b) => b - a)
  const straightHigh = getStraightHigh(uniqueRanks)
  if (isFlush && straightHigh) return [8, straightHigh]

  const groups = Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => (b.count - a.count) || (b.rank - a.rank))

  if (groups[0].count === 4) {
    const kicker = groups[1].rank
    return [7, groups[0].rank, kicker]
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return [6, groups[0].rank, groups[1].rank]
  }

  if (isFlush) return [5, ...ranks]
  if (straightHigh) return [4, straightHigh]

  if (groups[0].count === 3) {
    const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a)
    return [3, groups[0].rank, ...kickers]
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank)
    const lowPair = Math.min(groups[0].rank, groups[1].rank)
    const kicker = groups[2].rank
    return [2, highPair, lowPair, kicker]
  }

  if (groups[0].count === 2) {
    const kickers = groups.slice(1).map((g) => g.rank).sort((a, b) => b - a)
    return [1, groups[0].rank, ...kickers]
  }

  return [0, ...ranks]
}

function getStraightHigh(ranksDesc: number[]): number | null {
  if (ranksDesc.length < 5) return null
  const sorted = [...new Set(ranksDesc)].sort((a, b) => b - a)
  for (let i = 0; i <= sorted.length - 5; i += 1) {
    const slice = sorted.slice(i, i + 5)
    if (slice[0] - slice[4] === 4) return slice[0]
  }
  if (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && sorted.includes(3) && sorted.includes(2)) {
    return 5
  }
  return null
}

function compareRanks(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function suitToSymbol(suit: Suit): string {
  return suit === 's' ? '♠' : suit === 'h' ? '♥' : suit === 'd' ? '♦' : '♣'
}

export function suitColorClass(suit: Suit): string {
  return suit === 'h' || suit === 'd' ? 'suit-red' : 'suit-black'
}

export function getBestHandLabel(cards: Card[]): string {
  if (cards.length < 5) {
    const counts = new Map<number, number>()
    cards.forEach((card) => {
      const value = RANK_VALUE[card.rank]
      counts.set(value, (counts.get(value) ?? 0) + 1)
    })
    const values = Array.from(counts.values()).sort((a, b) => b - a)
    if (values[0] === 2) return 'One Pair'
    if (values[0] === 3) return 'Three of a Kind'
    return 'High Card'
  }

  const combos = getCombos(cards.length)
  let best = evaluate5(pick(cards, combos[0]))
  for (let i = 1; i < combos.length; i += 1) {
    const rank = evaluate5(pick(cards, combos[i]))
    if (compareRanks(rank, best) > 0) best = rank
  }
  return rankToLabel(best[0])
}

const COMBO_CACHE = new Map<number, number[][]>()

function getCombos(length: number): number[][] {
  if (length === 7) return COMBOS_7_5
  const cached = COMBO_CACHE.get(length)
  if (cached) return cached

  const indices = Array.from({ length }, (_, idx) => idx)
  const combos: number[][] = []
  const backtrack = (start: number, combo: number[]) => {
    if (combo.length === 5) {
      combos.push([...combo])
      return
    }
    for (let i = start; i < indices.length; i += 1) {
      combo.push(indices[i])
      backtrack(i + 1, combo)
      combo.pop()
    }
  }

  backtrack(0, [])
  COMBO_CACHE.set(length, combos)
  return combos
}

function rankToLabel(rank: number): string {
  switch (rank) {
    case 8:
      return 'Straight Flush'
    case 7:
      return 'Four of a Kind'
    case 6:
      return 'Full House'
    case 5:
      return 'Flush'
    case 4:
      return 'Straight'
    case 3:
      return 'Three of a Kind'
    case 2:
      return 'Two Pair'
    case 1:
      return 'One Pair'
    default:
      return 'High Card'
  }
}
