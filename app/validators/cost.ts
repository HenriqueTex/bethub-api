import vine from '@vinejs/vine'
import { COST_KINDS } from '#models/cost'

const fields = {
  description: vine.string().trim().minLength(1).maxLength(150),
  amount: vine.number().positive(),
  kind: vine.enum(COST_KINDS),
  startsOn: vine.date({ formats: ['YYYY-MM-DD'] }),
  endsOn: vine
    .date({ formats: ['YYYY-MM-DD'] })
    .nullable()
    .optional(),
  notes: vine.string().trim().maxLength(1000).nullable().optional(),
  tipsterIds: vine.array(vine.number().positive()).optional(),
}

export const costValidator = vine.compile(vine.object(fields))

export const costUpdateValidator = vine.compile(
  vine.object({
    description: fields.description.optional(),
    amount: fields.amount.optional(),
    kind: fields.kind.optional(),
    startsOn: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    endsOn: fields.endsOn,
    notes: fields.notes,
    tipsterIds: fields.tipsterIds,
  })
)
