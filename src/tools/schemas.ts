import { z } from 'zod';

export const serviceId = z.enum(['intro_consultation', 'individual_session']);
export const availabilitySchema = z
  .object({
    service_id: serviceId,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }, 'Use a valid calendar date'),
  })
  .strict();
export const bookingSchema = z
  .object({
    slot_id: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    client_name: z.string().trim().min(1).max(100),
    client_email: z.string().trim().email().max(254),
    adult_confirmed: z.literal(true),
    request_id: z.string().uuid(),
  })
  .strict();
export const paymentSchema = z
  .object({
    booking_id: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
  })
  .strict();
