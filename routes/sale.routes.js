import express from 'express';
import { body } from 'express-validator';
import { 
  createSale, 
  getSales, 
  getSaleById, 
  getDailySales 
} from '../controllers/sale.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Validation rules
const saleValidation = [
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.product').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isNumeric().withMessage('Unit price must be a number'),
  body('paymentMethod').isIn(['cash', 'card', 'credit', 'mixed']).withMessage('Invalid payment method'),
  body('paidAmount').isNumeric().withMessage('Paid amount must be a number')
];

router.use(auth);

router.post('/', validate(saleValidation), createSale);
router.get('/', getSales);
router.get('/daily', getDailySales);
router.get('/:id', getSaleById);

export default router;