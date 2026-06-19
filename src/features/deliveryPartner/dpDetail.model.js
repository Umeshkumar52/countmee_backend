import mongoose from 'mongoose';

const dpDetailSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  gender: { type: String, required: true },
  address: { type: String, required: true },
  profile_img: { type: String, required: true },
  online: { type: Number, default: 0 },
  document_approval: { type: String, enum: ['Approved', 'Rejected', 'Pending'], default: 'Pending' },
  status: { type: String, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  location: { type: String, default: '' }
}, { timestamps: true });

export const DpDetail = mongoose.model('DpDetail', dpDetailSchema);