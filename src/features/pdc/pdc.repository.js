import { PdcDocument } from './pdcDocument.model.js';
import { PdcAssignedOrder } from './pdcAssignedOrder.model.js';
import { PdcPackage } from './pdcPackage.model.js';
import { PdcPayout } from './pdcPayout.model.js';
import { User } from '../users/user.model.js';
import { Rating } from '../deliveryPartner/rating.model.js';

export const findUserByPhone = async (phone) => {
  return await User.findOne({ role: 'pdc', phone });
};

export const createUser = async (userData) => {
  return await User.create({
    role: 'pdc',
    ...userData
  });
};

export const createPdcDocument = async (pdcData) => {
  return await PdcDocument.create(pdcData);
};

export const findPdcDocumentByUserId = async (userId) => {
  const doc = await PdcDocument.findOne({ user_id: userId }).populate('user_id');
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    return obj;
  }
  return null;
};

export const findPdcDocumentById = async (id) => {
  const doc = await PdcDocument.findById(id).populate('user_id');
  if (doc) {
    const obj = doc.toObject();
    obj.userDetails = obj.user_id;
    return obj;
  }
  return null;
};

export const updatePdcDocumentByUserId = async (userId, updateData) => {
  return await PdcDocument.findOneAndUpdate({ user_id: userId }, updateData, { new: true });
};

export const updatePdcDocumentById = async (id, updateData) => {
  return await PdcDocument.findByIdAndUpdate(id, updateData, { new: true });
};

export const updateUser = async (userId, updateData) => {
  return await User.findByIdAndUpdate(userId, updateData, { new: true });
};

export const findUserById = async (userId) => {
  const user = await User.findById(userId);
  if (user) {
    const userObj = user.toObject();
    userObj.pdcDocument = await PdcDocument.findOne({ user_id: userId });
    return userObj;
  }
  return null;
};
