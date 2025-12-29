import express from 'express';
import { body } from 'express-validator';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  updateProduct, 
  deleteProduct,
  getLowStockProducts,
  updateStock,
  bulkImportProducts,
  
} from '../controllers/product.controller.js';
import { auth, superAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import multer from 'multer';

const router = express.Router();
// Configure multer with better settings
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream' // Sometimes needed for CSV
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});
// Validation rules
const productValidation = [
  body('productName').notEmpty().withMessage('Product name is required'),
  body('sizePackage').notEmpty().withMessage('Size/Package is required'),
  body('unit').notEmpty().withMessage('Unit is required'),
  body('salePrice').isNumeric().withMessage('Sale price must be a number'),
  body('purchasePrice').isNumeric().withMessage('Purchase price must be a number'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('category').notEmpty().withMessage('Category is required')
];
// Validation rules for supplier operations
const supplierUpdateValidation = [
  body('newName').notEmpty().withMessage('New supplier name is required').trim()
];

const mergeSuppliersValidation = [
  body('suppliersToMerge')
    .isArray({ min: 1 })
    .withMessage('Suppliers to merge must be a non-empty array'),
  body('targetSupplier')
    .notEmpty()
    .withMessage('Target supplier name is required')
    .trim()
];


// All routes require authentication
router.use(auth);

// Routes
router.post('/', superAdmin, validate(productValidation), createProduct);
router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProductById);
router.put('/:id', superAdmin, validate(productValidation), updateProduct);
router.delete('/:id', superAdmin, deleteProduct);
router.patch('/:id/stock', superAdmin, updateStock);
router.post('/bulk-import', auth, superAdmin, upload.single('file'), bulkImportProducts);


export default router;