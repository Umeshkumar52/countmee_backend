import * as usersService from './users.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiResponse } from '../../common/utils/responseFormatter.js';
import { validate } from '../../common/utils/validationHelper.js';
import * as usersValidation from './users.validation.js';

export const editProfile = asyncHandler(async (req, res) => {
  const { user_id, address } = validate(usersValidation.editCustomerProfileSchema, req.body);
  const profilePicPath = req.file ? req.file.path : null;

  const profile = await usersService.editProfile(user_id, address, profilePicPath);

  return res.json(ApiResponse.success({ profile }, 'Profile Updated Successfully'));
});

export const createAddress = asyncHandler(async (req, res) => {
  const { customer_id, location, latitude, longitude, phone_no } = validate(usersValidation.createAddressSchema, req.body);

  await usersService.createAddress(
    customer_id,
    location,
    Number(latitude),
    Number(longitude),
    phone_no
  );

  return res.json(ApiResponse.success(null, 'New Address Created'));
});

export const myAddress = asyncHandler(async (req, res) => {
  const { customer_id } = req.params;

  const myAddresses = await usersService.getAddresses(customer_id);

  return res.json(ApiResponse.success({ myAddresses }, 'All my addresses '));
});

export const recommendVehicle = asyncHandler(async (req, res) => {
  const { vehicle_type, weight, length, width, height, dimension_unit } = validate(usersValidation.recommendVehicleSchema, req.body);

  const result = await usersService.recommendVehicle(
    vehicle_type,
    Number(weight),
    Number(length),
    Number(width),
    Number(height),
    dimension_unit || 'cm'
  );

  return res.json(ApiResponse.success(result, result.message));
});
