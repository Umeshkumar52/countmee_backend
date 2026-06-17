import { Customer } from './customer.model.js';
import { CustomerAddress } from './address.model.js';

export const findProfileByUserId = async (user_id) => {
  return await Customer.findOne({ user_id });
};

export const createProfile = async (profileData) => {
  return await Customer.create(profileData);
};

export const createAddress = async (addressData) => {
  return await CustomerAddress.create(addressData);
};

export const findAddressesByCustomerId = async (customer_id) => {
  return await CustomerAddress.find({ customer_id });
};
