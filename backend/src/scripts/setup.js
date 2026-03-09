import { sql } from '../config/db.js';

async function initializeDatabase() {
    console.log("Connecting to Neon to initialize tables...");

    try {
        // 1. USERS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                currency_code TEXT DEFAULT 'SGD',
                google_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Users table is ready.");

        // 2. ACCOUNTS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS accounts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'checking',
                is_default BOOLEAN DEFAULT FALSE, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- ADDED MISSING COMMA
                UNIQUE(user_id, name, type) 
            );
        `;
        console.log("Accounts table is ready.");

        // 3. CATEGORIES TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                icon VARCHAR(50) NOT NULL DEFAULT 'ellipse',
                type VARCHAR(50) NOT NULL DEFAULT 'expense',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- ADDED MISSING COMMA
                UNIQUE(user_id, name, type) 
            );
        `;
        console.log("Categories table is ready.");

        // 4. TRANSACTIONS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                title VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Transactions table is ready.");

        console.log("Database initialization complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
}

initializeDatabase();