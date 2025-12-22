import Product from '../models/Product.model.js';
import { validationResult } from 'express-validator';

import multer from 'multer';
import xlsx from 'xlsx';
export const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const product = new Product(req.body);
    await product.save();
    
    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with this barcode already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;
    
    const query = { isActive: true };
    
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };
    
    const products = await Product.paginate(query, options);
    
    res.json({
      success: true,
      ...products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: Date.now() },
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
};

export const getLowStockProducts = async (req, res) => {
  try {
    const lowStockProducts = await Product.getLowStock();
    
    res.json({
      success: true,
      data: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock products',
      error: error.message
    });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    if (operation === 'add') {
      product.quantity += quantity;
    } else if (operation === 'subtract') {
      if (product.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock'
        });
      }
      product.quantity -= quantity;
    }
    
    await product.save();
    
    res.json({
      success: true,
      data: product,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating stock',
      error: error.message
    });
  }
};

export const bulkImportProducts = async (req, res) => {
  try {
    // Debug log to check if file exists
    console.log('Bulk import request received');
    console.log('File exists:', !!req.file);
    console.log('File info:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    
    if (!req.file) {
      console.log('No file uploaded - returning error');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select a CSV or Excel file.'
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Please upload a CSV or Excel file.'
      });
    }

    console.log('Processing file:', req.file.originalname);
    
    // Read the uploaded file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    console.log('Parsed rows:', jsonData.length);
    
    if (jsonData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data found in the uploaded file'
      });
    }

    const results = {
      total: jsonData.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Process each row
    for (const [index, row] of jsonData.entries()) {
      try {
        // Map CSV columns to product fields with better validation
        const productData = {
          productName: String(row['Product Name'] || row['productName'] || '').trim(),
          sizePackage: String(row['Size/Package'] || row['sizePackage'] || row['Size'] || '').trim(),
          unit: (String(row['Unit'] || row['unit'] || 'piece').trim()).toLowerCase(),
          category: (String(row['Category'] || row['category'] || 'other').trim()).toLowerCase(),
          quantity: Math.max(0, parseInt(row['Stock'] || row['quantity'] || row['Quantity'] || 0) || 0),
          purchasePrice: Math.max(0, parseFloat(row['Purchase Price'] || row['purchasePrice'] || row['Cost'] || row['cost'] || 0) || 0),
          salePrice: Math.max(0, parseFloat(row['Sale Price'] || row['salePrice'] || row['Price'] || row['price'] || 0) || 0),
          minStockLevel: Math.max(1, parseInt(row['Minimum Stock'] || row['minStockLevel'] || row['Minimum'] || row['minimumStock'] || 10) || 10),
          barcode: String(row['Barcode'] || row['barcode'] || '').trim(),
          discount: Math.min(100, Math.max(0, parseFloat(row['Discount'] || row['discount'] || 0) || 0)),
           isActive: true,
           supplier: String(row['Supplier'] || row['supplier'] || '').trim()
        };

        // Validate required fields
        if (!productData.productName) {
          throw new Error('Product name is required');
        }
        
        if (!productData.salePrice || productData.salePrice <= 0) {
          throw new Error('Valid sale price is required');
        }

        // Validate unit against allowed values
        const allowedUnits = ['piece', 'pack', 'box', 'kg', 'liter', 'meter'];
        if (!allowedUnits.includes(productData.unit)) {
          productData.unit = 'piece'; // Default to piece if invalid
        }

        // Validate category against allowed values
        const allowedCategories = ['hardware', 'electrical', 'plumbing', 'tools', 'paint', 'other'];
        if (!allowedCategories.includes(productData.category)) {
          productData.category = 'other'; // Default to other if invalid
        }

        // Check if product exists by barcode or name
        let existingProduct = null;
        
        // First try to find by barcode if provided
        if (productData.barcode) {
          existingProduct = await Product.findOne({ barcode: productData.barcode });
        }
        
        // If not found by barcode, try by product name
        if (!existingProduct) {
          existingProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${productData.productName}$`, 'i') }
          });
        }

        if (existingProduct) {
          // Update existing product - don't overwrite barcode if new one is empty
          const updateData = { ...productData };
          if (!updateData.barcode) {
            delete updateData.barcode; // Don't update barcode if empty
          }
          
          Object.assign(existingProduct, updateData);
          existingProduct.lastUpdated = Date.now();
          await existingProduct.save();
          console.log(`Updated existing product: ${productData.productName}`);
        } else {
          // Create new product
          const product = new Product(productData);
          await product.save();
          console.log(`Created new product: ${productData.productName}`);
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: index + 2, // +2 because header is row 1
          productName: row['Product Name'] || row['productName'] || 'Unknown',
          error: error.message
        });
        console.error(`Error processing row ${index + 2}:`, error.message);
      }
    }

    console.log(`Import completed: ${results.success} successful, ${results.failed} failed`);
    
    res.json({
      success: true,
      data: results,
      message: `Import completed: ${results.success} successful, ${results.failed} failed`
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing products',
      error: error.message
    });
  }
};

// Add a test endpoint for debugging
export const testFileUpload = async (req, res) => {
  try {
    console.log('Test endpoint called');
    console.log('Headers:', req.headers);
    console.log('File exists:', !!req.file);
    console.log('File:', req.file);
    console.log('Body:', req.body);
    
    if (req.file) {
      // Try to read the file to see if it's valid
      try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        const worksheet = workbook.Sheets[sheetNames[0]];
        const jsonData = xlsx.utils.sheet_to_json(worksheet);
        
        return res.json({
          success: true,
          message: 'File received successfully',
          fileInfo: {
            name: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size
          },
          dataInfo: {
            sheetCount: sheetNames.length,
            firstSheetName: sheetNames[0],
            rowCount: jsonData.length,
            firstRow: jsonData[0] || 'No data'
          }
        });
      } catch (readError) {
        return res.json({
          success: false,
          message: 'File received but cannot be read',
          error: readError.message,
          fileInfo: {
            name: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size
          }
        });
      }
    } else {
      return res.json({
        success: false,
        message: 'No file received',
        receivedHeaders: Object.keys(req.headers)
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};