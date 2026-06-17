import mongoose from 'mongoose';

const massCreditLogSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  role: { type: String, required: true }, // 'customer', 'dp', or 'all'
  credited_by: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  recipients_count: { type: Number, required: true },
  description: { type: String, required: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

massCreditLogSchema.virtual('user_type').get(function() {
  return this.role;
}).set(function(val) {
  this.role = val;
});

export const MassCreditLog = mongoose.model('MassCreditLog', massCreditLogSchema);