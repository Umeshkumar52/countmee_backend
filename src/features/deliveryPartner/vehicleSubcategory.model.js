import mongoose from 'mongoose';

const vehicleSubcategorySchema = new mongoose.Schema({
  vehicle_type: { 
    type: String, 
    required: true,
    enum: ['By Hand', 'Two Wheeler', 'Three Wheeler', 'Four Wheeler'] 
  },
  sub_vehicle_type: { 
    type: String, 
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  },
  status: {
    type: String,
    enum: ['Approved', 'Pending', 'Rejected'],
    default: 'Approved'
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const VehicleSubcategory = mongoose.model('VehicleSubcategory', vehicleSubcategorySchema);
