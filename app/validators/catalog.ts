import vine from '@vinejs/vine'

export const bookmakerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    website: vine.string().trim().maxLength(255).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    active: vine.boolean().optional(),
  })
)

export const accountValidator = vine.compile(
  vine.object({
    bookmakerId: vine.number().positive(),
    label: vine.string().trim().maxLength(100).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    active: vine.boolean().optional(),
    initialDeposit: vine.number().positive().optional(),
  })
)

export const accountUpdateValidator = vine.compile(
  vine.object({
    label: vine.string().trim().maxLength(100).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    active: vine.boolean().optional(),
  })
)

export const transactionValidator = vine.compile(
  vine.object({
    type: vine.enum(['deposit', 'withdrawal'] as const),
    amount: vine.number().positive(),
    occurredAt: vine.date({ formats: { utc: true } }).optional(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)

export const tipsterValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    channel: vine.string().trim().maxLength(255).optional().nullable(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    active: vine.boolean().optional(),
  })
)

export const methodValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    description: vine.string().trim().maxLength(1000).optional().nullable(),
    active: vine.boolean().optional(),
  })
)

export const marketValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
  })
)

export const settingsValidator = vine.compile(
  vine.object({
    unitValue: vine.number().positive(),
  })
)
