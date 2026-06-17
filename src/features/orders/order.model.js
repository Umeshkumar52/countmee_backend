import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  package_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PackageDetail', default: null },
  pickup_location: { type: String, required: true },
  sender_latitude: { type: Number, required: true },
  sender_longitude: { type: Number, required: true },
  drop_location: { type: String, required: true },
  receiver_latitude: { type: Number, required: true },
  receiver_longitude: { type: Number, required: true },
  mode_of_transport: { type: String, required: true },
  sender_name: { type: String, required: true },
  sender_phone: { type: String, required: true },
  how_to_reach_sender_location: { type: String, default: null },
  receiver_name: { type: String, required: true },
  receiver_phone: { type: String, required: true },
  how_to_reach_receiver_address: { type: String, default: null },
  distance: { type: Number, required: true },
  charges: { type: Number, required: true },
  user_action: { type: Number, default: null },
  cancel_order_reason: { type: String, default: null },
  status_completed: { type: String, default: null },
  dp_accept_time: { type: Date, default: null },
  dp_pickup_time: { type: Date, default: null },
  dp_deliver_time: { type: Date, default: null },
  pickup_otp: { type: Number, required: true },
  drop_otp: { type: Number, required: true },
  delivery_type: { type: String, default: 'direct' },
  broadcast_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Broadcast', default: null },
  pickup_dp_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  delivery_dp_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: Number, default: 0 }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

export const Order = mongoose.model('Order', orderSchema);