import { DpDetail } from './dpDetail.model.js';
import { DpDocument } from './dpDocument.model.js';
import { DpPayout } from './dpPayout.model.js';
import { Rating } from './rating.model.js';
import { User } from '../users/user.model.js';
import { Travel } from '../orders/travel.model.js';
import { OrderRequest } from '../orders/orderRequest.model.js';

export const findDpDetailByUserId = async (user_id) => {
  return await DpDetail.findOne({ user_id });
};

export const createDpDetail = async (detailData) => {
  return await DpDetail.create(detailData);
};

export const findDpDocumentByUserId = async (user_id) => {
  return await DpDocument.findOne({ user_id });
};

export const createDpDocument = async (docData) => {
  return await DpDocument.create(docData);
};

export const updateDpDetail = async (user_id, updateData) => {
  return await DpDetail.findOneAndUpdate({ user_id }, updateData, { new: true });
};

export const updateDpDocument = async (user_id, updateData) => {
  return await DpDocument.findOneAndUpdate({ user_id }, updateData, { new: true });
};

export const findRatingsForDp = async (to_dp) => {
  const ratings = await Rating.find({ to_dp })
    .populate('from_customer')
    .populate('from_dp')
    .populate('from_pdc')
    .sort({ created_at: -1 });

  return ratings.map(r => {
    const obj = r.toObject();
    obj.fromCustomer = obj.from_customer;
    obj.fromDp = obj.from_dp;
    obj.fromPdc = obj.from_pdc;
    return obj;
  });
};

export const getDpAverageRating = async (to_dp) => {
  const ratings = await Rating.find({ to_dp });
  if (!ratings.length) return 0;
  const sum = ratings.reduce((acc, curr) => acc + curr.stars, 0);
  return sum / ratings.length;
};

export const findTravelByOrderAndUser = async (order_id, user_id) => {
  return await Travel.findOne({ order_id, user_id }).sort({ created_at: -1 });
};

export const createTravel = async (travelData) => {
  return await Travel.create(travelData);
};

export const findPayoutsByDp = async (dp_auth_id) => {
  return await DpPayout.find({ dp_auth_id }).sort({ created_at: -1 });
};

export const createPayout = async (payoutData) => {
  return await DpPayout.create(payoutData);
};
