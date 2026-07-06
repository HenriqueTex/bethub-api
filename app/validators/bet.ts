import vine from '@vinejs/vine'
import { BET_RESULTS } from '#models/bet'

export const betValidator = vine.compile(
  vine.object({
    bookmakerAccountId: vine.number().positive(),
    tipsterId: vine.number().positive().optional().nullable(),
    methodId: vine.number().positive().optional().nullable(),
    marketId: vine.number().positive().optional().nullable(),
    marketName: vine.string().trim().minLength(1).maxLength(100).optional(),
    event: vine.string().trim().minLength(1).maxLength(200),
    selection: vine.string().trim().minLength(1).maxLength(200),
    sport: vine.string().trim().maxLength(50).optional().nullable(),
    competition: vine.string().trim().maxLength(100).optional().nullable(),
    eventDate: vine.date({ formats: { utc: true } }).optional().nullable(),
    odd: vine.number().min(1.01),
    units: vine.number().positive(),
    stakeAmount: vine.number().positive().optional(),
    placedAt: vine.date({ formats: { utc: true } }).optional(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)

export const betUpdateValidator = vine.compile(
  vine.object({
    bookmakerAccountId: vine.number().positive().optional(),
    tipsterId: vine.number().positive().optional().nullable(),
    methodId: vine.number().positive().optional().nullable(),
    marketId: vine.number().positive().optional().nullable(),
    marketName: vine.string().trim().minLength(1).maxLength(100).optional(),
    event: vine.string().trim().minLength(1).maxLength(200).optional(),
    selection: vine.string().trim().minLength(1).maxLength(200).optional(),
    sport: vine.string().trim().maxLength(50).optional().nullable(),
    competition: vine.string().trim().maxLength(100).optional().nullable(),
    eventDate: vine.date({ formats: { utc: true } }).optional().nullable(),
    odd: vine.number().min(1.01).optional(),
    units: vine.number().positive().optional(),
    stakeAmount: vine.number().positive().optional(),
    placedAt: vine.date({ formats: { utc: true } }).optional(),
    notes: vine.string().trim().maxLength(1000).optional().nullable(),
  })
)

export const settleBetValidator = vine.compile(
  vine.object({
    result: vine.enum(BET_RESULTS),
    cashoutAmount: vine.number().min(0).optional().requiredWhen('result', '=', 'cashout'),
  })
)
