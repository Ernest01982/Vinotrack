import { z } from 'zod';

/**
 * Defines the schema for the environment variables.
 * This ensures that the required variables are present and have the correct format.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url({ message: "Invalid Supabase URL. Please check your .env file." }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, { message: "Supabase anon key is required. Please check your .env file." }),
});

// Parse the environment variables against the schema
const parsedEnv = envSchema.safeParse(import.meta.env);

// If validation fails, log the errors and throw an error to halt the application
if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error("Invalid or missing environment variables. See console for details.");
}

/**
 * Export the validated and typed environment variables.
 * This object should be used throughout the application to access environment variables.
 */
export const env = parsedEnv.data;
