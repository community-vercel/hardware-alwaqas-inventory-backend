import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  updateUser,
  deleteUser
} from '../controllers/auth.controller.js';
import { auth, superAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';

const router = express.Router();

// Validation rules
const loginValidation = [
  body('email').notEmpty().withMessage('Email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const registerValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['superadmin', 'admin', 'staff']).withMessage('Invalid role')
];

const updateProfileValidation = [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

// --- Public routes ---
router.post('/login', validate(loginValidation), login);
router.post('/register', register);

// --- Protected routes ---
router.use(auth);

router.get('/profile', getProfile);
router.put('/profile', validate(updateProfileValidation), updateProfile);

// --- Superadmin only routes ---
router.get('/users', superAdmin, getAllUsers);
router.put('/users/:id', superAdmin, validate(updateProfileValidation), updateUser);
router.delete('/users/:id', superAdmin, deleteUser);

export default router;