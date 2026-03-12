import { sql } from '../config/db.js';

async function initializeDatabase() {
    console.log("Connecting to Neon to initialize tables...");

    try {
        // 1. USERS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
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
                balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
                is_default BOOLEAN DEFAULT FALSE, 

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, name, type) 
            );
        `;
        console.log("Accounts table is ready.");

        // 3. CATEGORIES TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS categories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                // userid can be null for global system categories
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,

                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'expense',
                is_system BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- ADDED MISSING COMMA
                UNIQUE(user_id, name, type) 
            );
        `;
        console.log("Categories table is ready.");

        // 4. RECURRING_TRANSACTIONS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS recurring_transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

                title VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                frequency VARCHAR(50) NOT NULL,
                
                next_run_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;    
        console.log("Recurring transactions table is ready.");

        // 5. TRANSACTIONS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS transactions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
                recurring_id UUID REFERENCES recurring_transactions(id) ON DELETE SET NULL,
                transfer_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,

                title VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                notes TEXT,
                transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        console.log("Transactions table is ready.");

        //  6. BUDGETS TABLE
        await sql`
            CREATE TABLE IF NOT EXISTS budgets (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                category_id UUID REFERENCES categories(id) ON DELETE CASCADE,

                name VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                period VARCHAR(50) DEFAULT 'monthly',
                start_date DATE NOT NULL,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(user_id, category_id, start_date)
            );
        `;
        console.log("Budgets table is ready.");

        console.log("Database initialization complete!");
        process.exit(0);
    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
}

initializeDatabase();