export type AnalysisMode = 'punter' | 'surebet'

export interface AnalyzedBetLeg {
  selection: string | null
  marketName: string | null
  odd: number | null
  stakeAmount: number | null
  bookmaker: string | null
  type: 'back' | 'lay' | null
}

export interface BetImageAnalysisResult {
  isBet: boolean
  event: string | null
  selection: string | null
  marketName: string | null
  bookmaker: string | null
  odd: number | null
  units: number | null
  stakeAmount: number | null
  sport: string | null
  competition: string | null
  placedAt: string | null
  notes: string | null
  warnings: string[]
  legs: AnalyzedBetLeg[]
}

const nullableText = { type: 'STRING', nullable: true }
const nullableNumber = { type: 'NUMBER', nullable: true }
const legProperties = {
  selection: nullableText,
  marketName: nullableText,
  bookmaker: nullableText,
  odd: nullableNumber,
  stakeAmount: nullableNumber,
  type: { type: 'STRING', enum: ['back', 'lay'], nullable: true },
}

export function analysisSchema(mode: AnalysisMode) {
  const properties = {
    isBet: { type: 'BOOLEAN' },
    event: nullableText,
    selection: nullableText,
    marketName: nullableText,
    bookmaker: nullableText,
    odd: nullableNumber,
    units: nullableNumber,
    stakeAmount: nullableNumber,
    sport: nullableText,
    competition: nullableText,
    placedAt: nullableText,
    warnings: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 5 },
    ...(mode === 'surebet'
      ? {
          legs: {
            type: 'ARRAY',
            maxItems: 3,
            items: {
              type: 'OBJECT',
              properties: legProperties,
              required: Object.keys(legProperties),
            },
          },
        }
      : {}),
  }
  return { type: 'OBJECT', properties, required: Object.keys(properties) }
}

function text(value: unknown, maxLength = 200) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null
}

function positiveNumber(value: unknown, minimum = Number.MIN_VALUE) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum ? value : null
}

export function parseAnalysis(raw: string): BetImageAnalysisResult {
  let value: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      typeof parsed.isBet !== 'boolean'
    )
      throw new Error('Invalid shape')
    value = parsed
  } catch {
    throw new Error('A leitura retornou dados inválidos. Tente novamente ou preencha manualmente.')
  }
  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .map((item) => text(item, 240))
        .filter((item): item is string => !!item)
        .slice(0, 5)
    : []
  const odd = positiveNumber(value.odd, 1.01)
  const stakeAmount = positiveNumber(value.stakeAmount)
  if (value.odd !== undefined && value.odd !== null && odd === null)
    warnings.push('Confira a odd: não foi possível validá-la.')
  if (value.stakeAmount !== undefined && value.stakeAmount !== null && stakeAmount === null)
    warnings.push('Confira o valor apostado.')
  const rawDate = text(value.placedAt)
  const validDate =
    rawDate &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(rawDate) &&
    !Number.isNaN(Date.parse(rawDate))
  if (rawDate && !validDate) warnings.push('Confira a data e o fuso horário da aposta.')
  const result: BetImageAnalysisResult = {
    isBet: value.isBet === true,
    event: text(value.event),
    selection: text(value.selection),
    marketName: text(value.marketName, 100),
    bookmaker: text(value.bookmaker, 100),
    odd,
    units: positiveNumber(value.units),
    stakeAmount,
    sport: text(value.sport, 50),
    competition: text(value.competition, 100),
    placedAt: validDate ? new Date(rawDate!).toISOString() : null,
    notes: null,
    warnings,
    legs: Array.isArray(value.legs)
      ? value.legs
          .slice(0, 3)
          .filter((leg) => leg && typeof leg === 'object')
          .map((leg) => ({
            selection: text(leg.selection),
            marketName: text(leg.marketName, 100),
            bookmaker: text(leg.bookmaker, 100),
            odd: positiveNumber(leg.odd, 1.01),
            stakeAmount: positiveNumber(leg.stakeAmount),
            type: leg.type === 'back' || leg.type === 'lay' ? leg.type : null,
          }))
      : [],
  }
  if (!result.isBet)
    return {
      ...result,
      event: null,
      selection: null,
      marketName: null,
      bookmaker: null,
      odd: null,
      units: null,
      stakeAmount: null,
      sport: null,
      competition: null,
      placedAt: null,
      legs: [],
    }
  return result
}
