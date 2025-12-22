import express from 'express';
import { body } from 'express-validator';
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary
} from '../controllers/expense.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Validation rules
const expenseValidation = [
  body('description').notEmpty().withMessage('Description is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('category').isIn(['food', 'petrol', 'utilities', 'maintenance', 'salary', 'other'])
    .withMessage('Invalid expense category')
];

router.use(auth);

router.post('/', validate(expenseValidation), createExpense);
router.get('/', getExpenses);
router.get('/summary', getExpenseSummary);
router.get('/:id', getExpenseById);
router.put('/:id', validate(expenseValidation), updateExpense);
router.delete('/:id', deleteExpense);

export default router;