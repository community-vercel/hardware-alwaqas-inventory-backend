import Sale from '../models/Sale.model.js';
import Product from '../models/Product.model.js';
import mongoose from 'mongoose';
export const createSale = async (req, res) => {
  try {
    const { items, customer, paymentMethod, paidAmount } = req.body;
    
    // Validate stock availability first
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.productName} not found`
        });
      }
      
      if (product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.productName}. Available: ${product.quantity}`
        });
      }
    }
    
    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    
    const saleItems = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemDiscountAmount = ((item.discount || 0) / 100) * itemTotal;
      const itemFinalTotal = itemTotal - itemDiscountAmount;
      
      subtotal += itemTotal;
      totalDiscount += itemDiscountAmount;
      
      return {
        ...item,
        total: itemFinalTotal
      };
    });
    
    const grandTotal = subtotal - totalDiscount;
    const change = paidAmount - grandTotal;
    
    if (change < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient payment'
      });
    }
    
    // Generate invoice number manually
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Count today's sales for invoice number
    const todayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const todayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    const todaySalesCount = await Sale.countDocuments({
      saleDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });
    
    const invoiceNumber = `INV-${year}${month}${day}-${String(todaySalesCount + 1).padStart(4, '0')}`;
    
    // Create sale
    const sale = new Sale({
      invoiceNumber,
      items: saleItems,
      subtotal,
      totalDiscount,
      grandTotal,
      paymentMethod,
      paidAmount,
      change,
      customer,
      soldBy: req.user._id
    });
    
    await sale.save();
    
    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } }
      );
    }
    
    // Populate the sale with product details for response
    const populatedSale = await Sale.findById(sale._id);
    
    res.status(201).json({
      success: true,
      data: populatedSale,
      message: 'Sale completed successfully'
    });
    
  } catch (error) {
    console.error('Sale creation error:', error);
    
    // Check for specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    
    if (error.code === 11000) { // Duplicate key error
      return res.status(400).json({
        success: false,
        message: 'Duplicate invoice number detected. Please try again.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating sale',
      error: error.message
    });
  }
};
export const getSales = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      paymentMethod 
    } = req.query;
    
    const query = {};
    
    // Date filter
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) query.saleDate.$lte = new Date(endDate);
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { saleDate: -1 },
      populate: 'soldBy'
    };
    
    const sales = await Sale.paginate(query, options);
    
    res.json({
      success: true,
      ...sales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales',
      error: error.message
    });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('soldBy', 'username')
      .populate('items.product', 'productName barcode');
    
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sale',
      error: error.message
    });
  }
};

export const getDailySales = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const sales = await Sale.find({
      saleDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).sort({ saleDate: -1 });
    
    const totalSales = sales.reduce((sum, sale) => sum + sale.grandTotal, 0);
    const totalTransactions = sales.length;
    
    res.json({
      success: true,
      data: {
        sales,
        summary: {
          totalSales,
          totalTransactions,
          date: startOfDay.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching daily sales',
      error: error.message
    });
  }
};