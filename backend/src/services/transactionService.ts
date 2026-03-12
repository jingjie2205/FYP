import { sql } from "../config/db.js"

interface TransactionParams {
  user_id: string
  account_id: string
  title: string
  amount: number
  type: "income" | "expense" | "transfer"
  category_id?: string | null
  recurring_id?: string | null
  transfer_account_id?: string | null
  notes?: string | null
  transaction_date: Date
}

export async function createTransactionRecord({
  user_id,
  account_id,
  title,
  amount,
  type,
  category_id = null,
  recurring_id = null,
  transfer_account_id = null,
  notes = null,
  transaction_date
}: TransactionParams) {
    
  const result = await sql`
    INSERT INTO transactions (
      user_id,
      account_id,
      category_id,
      recurring_id,
      transfer_account_id,
      title,
      amount,
      type,
      notes,
      transaction_date
    )
    VALUES (
      ${user_id},
      ${account_id},
      ${category_id},
      ${recurring_id},
      ${transfer_account_id},
      ${title},
      ${amount},
      ${type},
      ${notes},
      ${transaction_date}
    )
    RETURNING *
  `

  return result[0]
}