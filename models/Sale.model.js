import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  discount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  itemTotal: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  itemDiscounts: {
    type: Number,
    default: 0
  },
  globalDiscount: {
    type: Number,
    default: 0
  },
  globalDiscountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  globalDiscountAmount: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'credit', 'mixed'],
    default: 'cash'
  },
  paidAmount: {
    type: Number,
    required: true
  },
  change: {
    type: Number,
    default: 0
  },
  customer: {
    name: String,
    phone: String,
    address: String
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  saleDate: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// IMPORTANT: ONLY UPDATE STOCK HERE, NOT IN CONTROLLER
// This is the single source of truth for stock updates
// Invoice number is generated in the controller before save
saleSchema.post('save', async function(doc) {
  try {
    const Product = mongoose.model('Product');
    
    for (const item of doc.items) {
      const result = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      );
      
      if (!result) {
        console.error(`Product ${item.product} not found for stock update`);
      }
    }
  } catch (error) {
    console.error('Error updating stock after sale:', error);
    // Log error but don't throw since this is post-save
  }
});

// Optional: Add a method to calculate totals from items
saleSchema.methods.recalculateTotals = function() {
  let subtotal = 0;
  let itemDiscounts = 0;
  
  this.items.forEach(item => {
    subtotal += item.itemTotal;
    itemDiscounts += item.discountAmount;
  });
  
  this.subtotal = subtotal;
  this.itemDiscounts = itemDiscounts;
  this.totalDiscount = itemDiscounts + (this.globalDiscountAmount || 0);
  this.grandTotal = subtotal - this.totalDiscount;
  
  return this;
};

saleSchema.plugin(mongoosePaginate);

export default mongoose.model('Sale', saleSchema);