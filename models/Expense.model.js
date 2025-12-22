import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['food', 'petrol', 'utilities', 'maintenance', 'salary', 'other']
  },
  expenseDate: {
    type: Date,
    default: Date.now
  },
  paidBy: {
    type: String
  },
  receiptNumber: {
    type: String
  },
  notes: {
    type: String
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

expenseSchema.plugin(mongoosePaginate);

export default mongoose.model('Expense', expenseSchema);