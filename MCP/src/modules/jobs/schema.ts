import { z } from 'zod/v4';

export const jobPayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  requirements: z.string().default(''),
  salary: z.string().min(1),
  city: z.string().min(1),
  sourceUrl: z.string().url(),
  externalApplicationInstructions: z.string().optional(),
  allowSimilarDuplicate: z.boolean().default(false),
}).catchall(z.unknown());

export type JobPayload = z.infer<typeof jobPayloadSchema>;
