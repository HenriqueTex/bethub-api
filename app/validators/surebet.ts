import vine from '@vinejs/vine'

export const surebetValidator = vine.compile(
  vine.object({
    event: vine.string().trim().minLength(1).maxLength(200),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
    legs: vine
      .array(
        vine.object({
          bookmakerAccountId: vine.number().positive(),
          selection: vine.string().trim().minLength(1).maxLength(200),
          odd: vine.number().min(1.01),
          stakeAmount: vine.number().positive(),
        })
      )
      .minLength(2)
      .maxLength(10),
  })
)
