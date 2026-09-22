import type { BetResult } from '#models/bet'

interface ProfitInput {
  result: BetResult
  stakeAmount: number
  odd: number
  cashoutAmount?: number | null
  isFreebet?: boolean
}

const round = (value: number) => Math.round(value * 100) / 100

export function calculateProfit({
  result,
  stakeAmount,
  odd,
  cashoutAmount,
  isFreebet,
}: ProfitInput) {
  if (isFreebet) {
    // Freebet SNR (Stake Not Returned): o stake não é do apostador.
    // Ganhando, o lucro é apenas o excedente (odd - 1); perdendo, não há perda real.
    switch (result) {
      case 'pending':
        return null
      case 'green':
        return round(stakeAmount * (odd - 1))
      case 'half_green':
        return round((stakeAmount * (odd - 1)) / 2)
      case 'red':
      case 'half_red':
      case 'void':
        return 0
      case 'cashout':
        return round(cashoutAmount ?? 0)
    }
  }

  switch (result) {
    case 'pending':
      return null
    case 'green':
      return round(stakeAmount * (odd - 1))
    case 'red':
      return round(-stakeAmount)
    case 'half_green':
      return round((stakeAmount * (odd - 1)) / 2)
    case 'half_red':
      return round(-stakeAmount / 2)
    case 'void':
      return 0
    case 'cashout':
      return round((cashoutAmount ?? 0) - stakeAmount)
  }
}
