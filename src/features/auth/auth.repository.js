import { User } from "../users/user.model.js";
import { ROLES } from "../../constants/index.js";
import { DpDetail } from "../deliveryPartner/dpDetail.model.js";
import { DpDocument } from "../deliveryPartner/dpDocument.model.js";
import { Customer } from "../users/customer.model.js";

export const findUserByPhoneAndType = async (phone, role) => {
  const user = await User.findOne({ phone, role });
  if (user) {
    const userObj = user.toObject();
    if (role === ROLES.DP) {
      userObj.dpDetail = await DpDetail.findOne({ user_id: user?._id });
    }
    return userObj;
  }
  return null;
};

export const findUserByEmailPhoneAndType = async (email, phone, role) => {
  return await User.findOne({ email, phone, role });
};

export const findUserById = async (id) => {
  const user = await User.findById(id);
  if (user) {
    const userObj = user.toObject();
    if (user.role === ROLES.DP) {
      userObj.dpDetail = await DpDetail.findOne({ user_id: id });
      userObj.dpDocuments = await DpDocument.findOne({ user_id: id });
    } else if (user.role === ROLES.USER) {
      userObj.customer = await Customer.findOne({ user_id: id });
    }
    return userObj;
  }
  return null;
};

export const createUser = async (userData) => {
  return await User.create(userData);
};

export const updateUserTokens = async (userId, refreshToken) => {
  return await User.findByIdAndUpdate(userId, { refreshToken }, { new: true });
};

export const updateUserOtp = async (userId, otp) => {
  return await User.findByIdAndUpdate(userId, { otp }, { new: true });
};

export const deleteUserByPhone = async (phone) => {
  return await User.findOneAndDelete({ phone });
};

export const findAdminUser = async () => {
  return await User.findOne({ role: ROLES.ADMIN });
};
