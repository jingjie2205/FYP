import { sql } from "../../config/db.js";

export async function seedCategories() {
    console.log("Seeding categories...");

    try {
        await sql`
            INSERT INTO categories (name, type, is_system)
            VALUES ('Food & Drinks 🍔', 'expense', TRUE),
                   ('Shopping 🛍️', 'expense', TRUE),
                   ('Transportation 🚗', 'expense', TRUE),
                   ('Entertainment 🎮', 'expense', TRUE),
                   ('Bills 💡', 'expense', TRUE),
                   ('Salary 💰', 'income', TRUE),
                   ('Freelance 💰', 'income', TRUE),
                   (Subscriptions 🔄', 'income', TRUE),
                   ('Other', 'expense', TRUE)
            
            ON CONFLICT DO NOTHING;
        `;  

        console.log("Global Shared Categories seeded successfully.");
    } catch (error) {
        console.error("Error seeding global shared categories:", error);
    } 
}

seedCategories();   