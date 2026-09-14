import {z} from "zod";
const topics = ["privacy", "social-media", "contracts", "safety", "ai", "copyright", "general"] as const;

export const CreateRequestInput = z.object({
  subject: z.string().trim().min(5).max(120),
  topic: z.enum(topics),
  message: z.string().trim().min(10).max(4000),
  advisorId: z.string().uuid().nullable().optional(),
  allowAiFallback: z.boolean().default(false),
});

