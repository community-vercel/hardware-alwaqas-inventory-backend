import Sale from '../models/Sale.model.js';
import Product from '../models/Product.model.js';
import mongoose from 'mongoose';

export const createSale = async (req, res) => {
  try {
    const { 
      items, 
      customer, 
      paymentMethod, 
      paidAmount,
      globalDiscount,
      globalDiscountType 
    } = req.body;
    
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
    
    // Calculate totals with proper discount handling
    let subtotal = 0;
    let itemDiscounts = 0;
    
    const saleItems = items.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      let itemDiscountAmount = 0;
      
      // Calculate item-level discount
      if (item.discountType === 'percentage') {
        itemDiscountAmount = ((item.discount || 0) / 100) * itemTotal;
      } else {
        // Fixed discount
        itemDiscountAmount = Math.min(item.discount || 0, itemTotal);
      }
      
      const itemFinalTotal = itemTotal - itemDiscountAmount;
      
      subtotal += itemTotal;
      itemDiscounts += itemDiscountAmount;
      
      return {
        ...item,
        itemTotal,
        discountAmount: itemDiscountAmount,
        total: itemFinalTotal
      };
    });
    
    // Calculate global discount on subtotal after item discounts
    const afterItemDiscounts = subtotal - itemDiscounts;
    let globalDiscountAmount = 0;
    
    if (globalDiscount && globalDiscount > 0) {
      if (globalDiscountType === 'percentage') {
        globalDiscountAmount = (globalDiscount / 100) * afterItemDiscounts;
      } else {
        // Fixed discount - cap it to the remaining total
        globalDiscountAmount = Math.min(globalDiscount, afterItemDiscounts);
      }
    }
    
    const totalDiscount = itemDiscounts + globalDiscountAmount;
    const grandTotal = Math.max(0, subtotal - totalDiscount);
    const change = paidAmount - grandTotal;
    
    if (change < 0) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient payment'
      });
    }
    
    // GENERATE INVOICE NUMBER IN CONTROLLER (not in pre-save hook)
    let invoiceNumber;
    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // Create date range for today
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      // Count today's sales
      const count = await Sale.countDocuments({
        saleDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating invoice number',
        error: error.message
      });
    }
    
    // Create sale object with invoice number
    const sale = new Sale({
      invoiceNumber, // Set here
      items: saleItems.map(item => ({
        product: item.product,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discount: item.discount,
        discountAmount: item.discountAmount,
        itemTotal: item.itemTotal,
        total: item.total
      })),
      subtotal,
      itemDiscounts,
      globalDiscount: globalDiscount || 0,
      globalDiscountType: globalDiscountType || 'percentage',
      globalDiscountAmount,
      totalDiscount,
      grandTotal,
      paymentMethod,
      paidAmount,
      change,
      customer,
      soldBy: req.user._id
    });
    
    // Save sale - model post-save hook will update product stock
    await sale.save();
    
    // Populate the sale with product details for response
    const populatedSale = await Sale.findById(sale._id)
      .populate('soldBy', 'username')
      .populate('items.product', 'productName barcode');
    
    res.status(201).json({
      success: true,
      data: populatedSale,
      message: 'Sale completed successfully'
    });
    
  } catch (error) {
    console.error('Sale creation error:', error);
    
    // Check for specific errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map(err => err.message)
        .join(', ');
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: messages
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
      paymentMethod,
      search
    } = req.query;
    
    const query = {};
    
    // Date filter
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }
    
    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    // Search by invoice number or customer name
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { 'customer.address': { $regex: search, $options: 'i' } }
      ];
    }
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { saleDate: -1 },
      populate: {
        path: 'soldBy',
        select: 'username'
      }
    };
    
    const sales = await Sale.paginate(query, options);
    
    res.json({
      success: true,
      ...sales
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
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
      .populate('items.product', 'productName barcode sizePackage unit');
    
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
    console.error('Error fetching sale:', error);
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
    
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
    
    const sales = await Sale.find({
      saleDate: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
      .populate('soldBy', 'username')
      .sort({ saleDate: -1 });
    
    const totalSales = sales.reduce((sum, sale) => sum + sale.grandTotal, 0);
    const totalTransactions = sales.length;
    const totalDiscount = sales.reduce((sum, sale) => sum + (sale.totalDiscount || 0), 0);
    const totalItemsSold = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);
    
    // Payment breakdown
    const paymentBreakdown = {};
    sales.forEach(sale => {
      if (!paymentBreakdown[sale.paymentMethod]) {
        paymentBreakdown[sale.paymentMethod] = {
          count: 0,
          amount: 0
        };
      }
      paymentBreakdown[sale.paymentMethod].count += 1;
      paymentBreakdown[sale.paymentMethod].amount += sale.grandTotal;
    });
    
    res.json({
      success: true,
      data: {
        sales,
        summary: {
          totalSales,
          totalTransactions,
          totalDiscount,
          totalItemsSold,
          paymentBreakdown,
          date: startOfDay.toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    console.error('Error fetching daily sales:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily sales',
      error: error.message
    });
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.saleDate = {};
      if (startDate) query.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.saleDate.$lte = end;
      }
    }
    
    const sales = await Sale.find(query);
    
    const summary = {
      totalRevenue: 0,
      totalDiscount: 0,
      totalTransactions: sales.length,
      totalItemsSold: 0,
      paymentBreakdown: {}
    };
    
    sales.forEach(sale => {
      summary.totalRevenue += sale.grandTotal;
      summary.totalDiscount += sale.totalDiscount || 0;
      summary.totalItemsSold += sale.items.reduce((sum, item) => sum + item.quantity, 0);
      
      if (!summary.paymentBreakdown[sale.paymentMethod]) {
        summary.paymentBreakdown[sale.paymentMethod] = {
          count: 0,
          amount: 0
        };
      }
      
      summary.paymentBreakdown[sale.paymentMethod].count += 1;
      summary.paymentBreakdown[sale.paymentMethod].amount += sale.grandTotal;
    });
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching sales summary',
      error: error.message
    });
  }
};

export const refundSale = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the sale
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    
    // Restore stock for all items
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } }
      );
    }
    
    // Mark sale as refunded or delete it
    await Sale.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Sale refunded successfully. Stock restored.'
    });
  } catch (error) {
    console.error('Error refunding sale:', error);
    res.status(500).json({
      success: false,
      message: 'Error refunding sale',
      error: error.message
    });
  }
};

export const getCustomersFromSales = async (req, res) => {
  try {
    const { search } = req.query;
    
    // Create aggregation pipeline to get unique customers from sales
    const pipeline = [];
    
    // Match stage for search
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'customer.name': { $regex: search, $options: 'i' } },
            { 'customer.phone': { $regex: search, $options: 'i' } },
            { 'customer.address': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    // Group by customer phone (assuming phone is unique identifier)
    pipeline.push({
      $group: {
        _id: '$customer.phone',
        name: { $first: '$customer.name' },
        phone: { $first: '$customer.phone' },
        address: { $first: '$customer.address' },
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        lastPurchaseDate: { $max: '$saleDate' },
        firstPurchaseDate: { $min: '$saleDate' },
        // Get recent sales
        recentSales: {
          $push: {
            _id: '$_id',
            invoiceNumber: '$invoiceNumber',
            grandTotal: '$grandTotal',
            saleDate: '$saleDate',
            items: '$items'
          }
        }
      }
    });
    
    // Sort by last purchase date
    pipeline.push({
      $sort: { lastPurchaseDate: -1 }
    });
    
    // Project to format output
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        phone: 1,
        address: 1,
        totalPurchases: 1,
        totalSpent: 1,
        lastPurchaseDate: 1,
        firstPurchaseDate: 1,
        recentSales: { $slice: ['$recentSales', 5] } // Last 5 sales
      }
    });
    
    const customers = await Sale.aggregate(pipeline);
    
    // Calculate stats
    const stats = {
      totalCustomers: customers.length,
      vipCustomers: customers.filter(c => c.totalSpent > 1000).length, // Example threshold
      totalSpent: customers.reduce((sum, c) => sum + c.totalSpent, 0),
      averageOrderValue: customers.length > 0 
        ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length
        : 0
    };
    
    res.json({
      success: true,
      data: {
        docs: customers,
        total: customers.length,
        stats
      }
    });
    
  } catch (error) {
    console.error('Error fetching customers from sales:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
};