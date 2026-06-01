export const toGeoJSON = (vehicles) => {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((vehicle) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [vehicle.longitude, vehicle.latitude],
      },
      properties: {
        id: vehicle.id,
        name: vehicle.name,
        speed: vehicle.speed,
        heading: vehicle.heading,
        status: vehicle.status,
      },
    })),
  };
};
