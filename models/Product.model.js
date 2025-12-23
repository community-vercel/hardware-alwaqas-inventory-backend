import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  sizePackage: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true,
enum: [
    // Count
    'piece', 'pair', 'set', 'pack', 'box', 'bundle', 'carton',

    // Weight
    'gram', 'kg', 'ton',

    // Length
    'inch', 'feet', 'meter', 'roll', 'coil',

    // Volume
    'ml', 'liter', 'gallon', 'drum',

    // Area
    'sqft', 'sqm',

    // Electrical
    'ampere', 'watt'
  ]  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  category: {
    type: String,
    required: true,
    enum: ['hardware', 'electrical', 'plumbing', 'tools', 'paint', 'other']
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  supplier: {
    type: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add pagination plugin
productSchema.plugin(mongoosePaginate);

// Static method for low stock products
productSchema.statics.getLowStock = function() {
  return this.find({
    $expr: { $lte: ['$quantity', '$minStockLevel'] },
    isActive: true
  });
};

export default mongoose.model('Product', productSchema);