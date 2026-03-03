import { neon } from "@neondatabase/serverless";
import "dotenv/config";

// Initialize database connection
export const sql = neon(process.env.DATABASE_URL);