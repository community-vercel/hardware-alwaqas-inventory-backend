import express from 'express';
import { 
  getDashboardStats, 
  getRecentSales, 
  getTopProducts,
  getSalesSummary,
  getInventoryStats
} from '../controllers/dashboard.controller.js';
import { auth } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(auth);

router.get('/stats', getDashboardStats);
router.get('/recent-sales', getRecentSales);
router.get('/top-products', getTopProducts);
router.get('/sales-summary', getSalesSummary);
router.get('/inventory-stats', getInventoryStats);

export default router;