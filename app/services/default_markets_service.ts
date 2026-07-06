import Market from '#models/market'

const DEFAULT_MARKETS = [
  'Resultado Final (1X2)',
  'Moneyline',
  'Dupla Chance',
  'Empate Anula (DNB)',
  'Handicap Asiático',
  'Handicap Europeu',
  'Over/Under Gols',
  'Ambas Marcam (BTTS)',
  'Escanteios Over/Under',
  'Cartões Over/Under',
  'Total de Pontos',
  'Handicap de Pontos',
  'Vencedor do Mapa',
  'Handicap de Mapas',
  'Total de Kills',
  'First Blood',
  'Total de Games',
  'Vencedor do Set',
  'Jogador - Gols',
  'Múltipla',
]

export async function seedDefaultMarkets(userId: number) {
  await Market.createMany(
    DEFAULT_MARKETS.map((name) => ({
      userId,
      name,
      normalizedName: Market.normalize(name),
    }))
  )
}
