import * as usersRepository from './users.repository.js';
import { uploadToCloudinary } from '../../common/services/cloudinary.service.js';
import { DeliverCharge } from '../orders/deliverCharge.model.js';

export const editProfile = async (user_id, address, profilePicLocalPath, profilePicBodyUrl) => {
  let profilePicUrl = profilePicBodyUrl !== undefined ? profilePicBodyUrl : null;

  if (profilePicLocalPath) {
    const uploadResult = await uploadToCloudinary(profilePicLocalPath, 'customer_profiles');
    if (uploadResult) {
      profilePicUrl = uploadResult.secure_url;
    }
  }

  let profile = await usersRepository.findProfileByUserId(user_id);

  if (!profile) {
    profile = await usersRepository.createProfile({
      user_id,
      address,
      profile_pic: profilePicUrl
    });
  } else {
    if (address !== undefined) {
      profile.address = address;
    }
    if (profilePicUrl !== undefined && profilePicUrl !== null) {
      profile.profile_pic = profilePicUrl;
    } else if (profilePicBodyUrl === null || profilePicBodyUrl === "") {
      // Allow clearing the profile picture by explicitly passing null or empty string
      profile.profile_pic = null;
    }
    await profile.save();
  }

  return profile;
};

export const createAddress = async (customer_id, location, latitude, longitude, phone_no) => {
  return await usersRepository.createAddress({
    customer_id,
    location,
    latitude,
    longitude,
    phone_no
  });
};

export const getAddresses = async (customer_id) => {
  return await usersRepository.findAddressesByCustomerId(customer_id);
};

export const recommendVehicle = async (vehicle_type, weight, length, width, height, dimension_unit = 'cm') => {
  const allVehicles = await DeliverCharge.find({}).lean();
  if (!allVehicles || allVehicles.length === 0) {
    throw new Error("No vehicle configurations found.");
  }

  // Find the selected vehicle
  const selected = allVehicles.find(v => v.vehicle_type.toLowerCase() === vehicle_type.toLowerCase());

  // Function to convert value from given unit to target unit
  const convertDimension = (val, fromUnit, toUnit) => {
    if (!val || fromUnit === toUnit) return val;
    // Convert to cm
    let cmVal = val;
    switch (fromUnit.toLowerCase()) {
      case 'm': cmVal = val * 100; break;
      case 'ft': cmVal = val * 30.48; break;
      case 'inch': cmVal = val * 2.54; break;
    }
    // Convert from cm to target
    switch (toUnit.toLowerCase()) {
      case 'm': return cmVal / 100;
      case 'ft': return cmVal / 30.48;
      case 'inch': return cmVal / 2.54;
      default: return cmVal;
    }
  };

  // Function to check if a vehicle can accommodate the package
  const canAccommodate = (vehicle) => {
    const targetUnit = vehicle.dimension_unit || 'cm';
    const convL = convertDimension(length, dimension_unit, targetUnit);
    const convW = convertDimension(width, dimension_unit, targetUnit);
    const convH = convertDimension(height, dimension_unit, targetUnit);

    const wOk = !vehicle.max_weight || vehicle.max_weight >= weight;
    const lOk = !vehicle.max_length || vehicle.max_length >= convL;
    const wdOk = !vehicle.max_width || vehicle.max_width >= convW;
    const hOk = !vehicle.max_height || vehicle.max_height >= convH;
    
    return wOk && lOk && wdOk && hOk;
  };

  // If the selected vehicle exists and can accommodate the package
  if (selected && canAccommodate(selected)) {
    return {
      recommended_vehicle: selected.vehicle_type,
      is_upgrade: false,
      message: "Selected vehicle is suitable."
    };
  }

  // Filter all vehicles that can accommodate the package
  const capableVehicles = allVehicles.filter(canAccommodate);

  if (capableVehicles.length === 0) {
    throw new Error("Package is too large for any available vehicle.");
  }

  // Sort capable vehicles by base_price (cheapest first) to recommend the most cost-effective upgrade
  capableVehicles.sort((a, b) => (a.base_price || 0) - (b.base_price || 0));

  const recommended = capableVehicles[0];

  return {
    recommended_vehicle: recommended.vehicle_type,
    is_upgrade: true,
    message: "Recommended upgrade due to package size."
  };
};

export const deleteAddress = async (address_id, user_id) => {
  const address = await usersRepository.findAddressById(address_id);
  
  if (!address) {
    throw new Error("Address not found");
  }

  // Ensure the address belongs to the authenticated user
  if (address.customer_id.toString() !== user_id.toString()) {
    throw new Error("Unauthorized to delete this address");
  }

  return await usersRepository.deleteAddressById(address_id);
};
