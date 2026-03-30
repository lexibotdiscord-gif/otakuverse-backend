import mongoose from 'mongoose';

const DonationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  level: {
    type: String,
    enum: ['NONE', 'BRONZE', 'SILVER', 'GOLD', 'LEGEND'],
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['STRIPE', 'PAYPAL', 'GOOGLEPAY', 'APPLEPAY'],
    required: true
  },
  stripePaymentId: String,
  stripeSubscriptionId: String,
  transactionDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  renewalDate: Date,
  message: String,
  isPublic: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'COMPLETED'
  },
  badges: [String],
  benefits: [String]
});

DonationSchema.index({ userId: 1, transactionDate: -1 });
DonationSchema.index({ isActive: 1, expiryDate: 1 });

export default mongoose.model('Donation', DonationSchema);