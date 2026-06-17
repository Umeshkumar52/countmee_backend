import mongoose from 'mongoose';

const pdcPackageSchema = new mongoose.Schema({
  pdc_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  order_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
  package_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'PackageDetail' },
  package_count: { type: Number, default: 0 },
  date_of_order: { type: Date, default: Date.now },
  earnings: { type: Number, default: 0 }
}, { timestamps: true });

export const PdcPackage = mongoose.model('PdcPackage', pdcPackageSchema);