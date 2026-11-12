import { sql } from "../config/db.js";
import { createTransactionRecord } from "./transactionService.js"

export async function createAccountWithBalance(user_id : string, name : string, balance : number) {

    const newAccount  = await sql `
        INSERT INTO accounts (user_id, name, balance)
        VALUES (${user_id}, ${name}, ${balance})
        RETURNING *
    `
    const new_account_id = newAccount[0].id

    if  (balance !== 0) {
        await createTransactionRecord({
        user_id,
        account_id: new_account_id,
        title: "Initial Balance",
        amount: balance,
        type: "income",
        transaction_date: new Date()
        })
    }

    return newAccount[0];
}

export async function getUserFinancialData(userId: string) {
    const [
        accounts,
        categoryGroups,
        categories,
        savingsPlans,
        recurringTransactions,
        recentTransactions
    ] = await Promise.all([
        sql`SELECT * FROM accounts WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM category_groups WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM categories WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM savings_plans WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM recurring_transactions WHERE user_id = ${userId} ORDER BY created_at DESC`,
        sql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`
    ]);

    return {
        accounts,
        categoryGroups,
        categories,
        savingsPlans,
        recurringTransactions,
        recentTransactions
    };
}