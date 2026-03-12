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