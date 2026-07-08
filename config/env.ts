import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  DIRECT_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk Publishable Key is required"),
  CLERK_SECRET_KEY: z.string().min(1, "Clerk Secret Key is required"),
  CLERK_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
  CRON_SECRET: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  EMAIL_FROM_ADDRESS: z.string().email().default("alerts@sentinel.local"),
});

// For build-time checks on Vercel where production env vars are not fully loaded in the container,
// we parse using a relaxed schema or fallback values to prevent build crashes.
const isVercelBuild = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL || (isVercelBuild ? "postgresql://fallback:5432/db" : undefined),
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || (isVercelBuild ? "pk_fallback" : undefined),
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || (isVercelBuild ? "sk_fallback" : undefined),
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables configuration");
}

export const env = parsed.data;
