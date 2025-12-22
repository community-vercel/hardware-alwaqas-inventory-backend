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
  discount: {
    type: Number,
    default: 0
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
    unique: true
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true
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
    phone: String
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  saleDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// FIXED: Generate invoice number before save
saleSchema.pre('save', async function() {
  // Don't use next parameter in async function
  if (!this.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Create date range for today
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    try {
      const count = await this.constructor.countDocuments({
        saleDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // In async pre-save, throw error instead of calling next(error)
      throw error;
    }
  }
});

// Alternative: Use synchronous pre-save hook
// saleSchema.pre('save', function(next) {
//   if (!this.invoiceNumber) {
//     const date = new Date();
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
    
//     const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
//     const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    
//     this.constructor.countDocuments({
//       saleDate: {
//         $gte: startOfDay,
//         $lte: endOfDay
//       }
//     }).then((count) => {
//       this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
//       next();
//     }).catch((error) => {
//       console.error('Error generating invoice number:', error);
//       next(error);
//     });
//   } else {
//     next();
//   }
// });

// Update product stock after sale
saleSchema.post('save', async function(doc) {
  try {
    const Product = mongoose.model('Product');
    
    for (const item of doc.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: -item.quantity } }
      );
    }
  } catch (error) {
    console.error('Error updating stock after sale:', error);
    // Log error but don't throw since this is post-save
  }
});

saleSchema.plugin(mongoosePaginate);

export default mongoose.model('Sale', saleSchema);