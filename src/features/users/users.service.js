import * as usersRepository from './users.repository.js';
import { uploadToCloudinary } from '../../common/services/cloudinary.service.js';

export const editProfile = async (user_id, address, profilePicLocalPath) => {
  let profilePicUrl = null;

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
    profile.address = address;
    if (profilePicUrl) {
      profile.profile_pic = profilePicUrl;
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
