import Sale from '../models/Sale.model.js';
import Expense from '../models/Expense.model.js';
import Product from '../models/Product.model.js';
import Customer from '../models/Customer.model.js';

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    // Get start of month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get start of year
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    // Get 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Today's stats
    const todaySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: today, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // Yesterday's stats for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    const yesterdaySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: yesterday, $lte: yesterdayEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // This week sales
    const weeklySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$grandTotal' },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // This month sales
    const monthlySales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
          totalSales: { $sum: '$grandTotal' },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Today's expenses
    const todayExpenses = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: today, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    // Yesterday's expenses
    const yesterdayExpenses = await Expense.aggregate([
      {
        $match: {
          expenseDate: { $gte: yesterday, $lte: yesterdayEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: '$amount' }
        }
      }
    ]);

    // Low stock products
    const lowStockProducts = await Product.find({
      $expr: { $lte: ['$quantity', '$minStockLevel'] },
      quantity: { $gt: 0 } // Exclude out of stock
    })
    .select('productName sizePackage unit quantity minStockLevel lastUpdated')
    .sort({ quantity: 1 })
    .limit(10);

    // Out of stock products
    const outOfStockProducts = await Product.countDocuments({
      quantity: 0
    });

    // Total products count
    const totalProducts = await Product.countDocuments({});

    // Inventory total value
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } }
        }
      }
    ]);

    // Top selling products (last 30 days)
    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: thirtyDaysAgo }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          productName: 1,
          totalQuantity: 1,
          totalRevenue: 1
        }
      }
    ]);

    // Total customers
    const totalCustomers = await Customer.countDocuments({});

    // Year to date sales
    const yearToDateSales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startOfYear }
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // Calculate growth percentages
    const todaySalesAmount = todaySales[0]?.totalSales || 0;
    const yesterdaySalesAmount = yesterdaySales[0]?.totalSales || 0;
    const todayExpensesAmount = todayExpenses[0]?.totalExpenses || 0;
    const yesterdayExpensesAmount = yesterdayExpenses[0]?.totalExpenses || 0;

    const salesGrowth = yesterdaySalesAmount > 0 
      ? ((todaySalesAmount - yesterdaySalesAmount) / yesterdaySalesAmount * 100).toFixed(1)
      : todaySalesAmount > 0 ? 100 : 0;

    const expenseGrowth = yesterdayExpensesAmount > 0
      ? ((todayExpensesAmount - yesterdayExpensesAmount) / yesterdayExpensesAmount * 100).toFixed(1)
      : todayExpensesAmount > 0 ? 100 : 0;

    const todayProfit = todaySalesAmount - todayExpensesAmount;
    const yesterdayProfit = yesterdaySalesAmount - yesterdayExpensesAmount;
    const profitGrowth = yesterdayProfit > 0
      ? ((todayProfit - yesterdayProfit) / yesterdayProfit * 100).toFixed(1)
      : todayProfit > 0 ? 100 : 0;

    const todayTransactions = todaySales[0]?.totalTransactions || 0;
    const yesterdayTransactions = yesterdaySales[0]?.totalTransactions || 0;
    const transactionGrowth = yesterdayTransactions > 0
      ? ((todayTransactions - yesterdayTransactions) / yesterdayTransactions * 100).toFixed(1)
      : todayTransactions > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        today: {
          sales: todaySalesAmount,
          transactions: todayTransactions,
          expenses: todayExpensesAmount,
          profit: todayProfit,
          salesGrowth: `${salesGrowth}%`,
          expenseGrowth: `${expenseGrowth}%`,
          profitGrowth: `${profitGrowth}%`,
          transactionGrowth: `${transactionGrowth}%`
        },
        weeklySales,
        monthlySales,
        yearToDateSales: yearToDateSales[0] || { totalSales: 0, totalTransactions: 0 },
        totalProducts,
        inventoryValue: inventoryValue[0]?.totalValue || 0,
        lowStockCount: lowStockProducts.length,
        lowStockProducts,
        outOfStock: outOfStockProducts,
        topProducts,
        totalCustomers
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

export const getRecentSales = async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const recentSales = await Sale.find()
      .select('invoiceNumber customer saleDate grandTotal paymentMethod items')
      .populate('customer', 'name')
      .sort({ saleDate: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: recentSales
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recent sales',
      error: error.message
    });
  }
};

export const getTopProducts = async (req, res) => {
  try {
    const { limit = 10, days = 30 } = req.query;
    
    const date = new Date();
    date.setDate(date.getDate() - parseInt(days));

    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: date }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: topProducts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching top products',
      error: error.message
    });
  }
};

export const getSalesSummary = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const salesSummary = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$saleDate' }
          },
          totalSales: { $sum: '$grandTotal' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      data: salesSummary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sales summary',
      error: error.message
    });
  }
};

export const getInventoryStats = async (req, res) => {
  try {
    // Inventory by category
    const inventoryByCategory = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$purchasePrice'] } }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    // Stock status summary
    const stockStatus = await Product.aggregate([
      {
        $facet: {
          inStock: [
            {
              $match: {
                $expr: { $gt: ['$quantity', '$minStockLevel'] }
              }
            },
            { $count: 'count' }
          ],
          lowStock: [
            {
              $match: {
                $expr: { 
                  $and: [
                    { $lte: ['$quantity', '$minStockLevel'] },
                    { $gt: ['$quantity', 0] }
                  ]
                }
              }
            },
            { $count: 'count' }
          ],
          outOfStock: [
            { $match: { quantity: 0 } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byCategory: inventoryByCategory,
        stockStatus: {
          inStock: stockStatus[0]?.inStock[0]?.count || 0,
          lowStock: stockStatus[0]?.lowStock[0]?.count || 0,
          outOfStock: stockStatus[0]?.outOfStock[0]?.count || 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory stats',
      error: error.message
    });
  }
};