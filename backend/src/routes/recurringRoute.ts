import { Router } from 'express';
import { 
  getRecurringTransactions, 
  createRecurringTransaction, 
  updateRecurringTransaction, 
  deleteRecurringTransaction 
} from '../controllers/recurringController'; // Adjust path as needed

const router = Router();

// GET all recurring rules for user
router.get('/:userId', getRecurringTransactions);

// POST create a new recurring subscription/income item
router.post('/', createRecurringTransaction);

// PATCH update an existing rule
router.patch('/:id', updateRecurringTransaction);

// DELETE remove a recurring rule
router.delete('/:id', deleteRecurringTransaction);

export default router;