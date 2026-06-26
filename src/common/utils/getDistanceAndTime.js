// utils/getDistanceAndTime.js

import axios from "axios";

export const getDistanceAndTime = async ({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}) => {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destinationLat},${destinationLng}&departure_time=now&key=${process.env.GOOGLE_MAP_API_KEY}`;

    const response = await axios.get(url);

    const element = response.data.rows[0].elements[0];

    if (element.status !== "OK") {
      throw new Error("Route not found");
    }

    return {
      distanceText: element.distance.text,
      distanceValue: element.distance.value,

      durationText: element.duration.text,
      durationValue: element.duration.value,

      durationInTraffic: element.duration_in_traffic?.text || null,

      arrivalTime: new Date(
        Date.now() +
          (element.duration_in_traffic?.value || element.duration.value) * 1000,
      ),
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};
