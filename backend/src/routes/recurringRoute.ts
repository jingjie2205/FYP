import { Router } from 'express';
import { 
  getRecurringTransactions, 
  createRecurringTransaction, 
  updateRecurringTransaction, 
  deleteRecurringTransaction,
  processRecurringTransactions
} from '../controllers/recurringController.js';

const router = Router();

// POST post every due occurrence as a real transaction (called by the app with the phone's date)
router.post('/process/:userId', processRecurringTransactions);

// GET all recurring rules for user
router.get('/:userId', getRecurringTransactions);

// POST create a new recurring subscription/income item
router.post('/', createRecurringTransaction);

// PATCH update an existing rule
router.patch('/:id', updateRecurringTransaction);

// DELETE remove a recurring rule
router.delete('/:id', deleteRecurringTransaction);

export default router;