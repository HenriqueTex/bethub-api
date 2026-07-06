import Method from '#models/method'

export const DEFAULT_METHODS = ['Punter', 'Surebet']

export async function seedDefaultMethods(userId: number) {
  await Method.createMany(DEFAULT_METHODS.map((name) => ({ userId, name })))
}
