import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useVehicleStore } from '../store/useVehicleStore';
import VehiclePopup from './VehiclePopup';
import apiClient, { vehicleAPI } from '../services/api';
import { logger } from '../utils/logger';

const mapStyles = `
  .maplibregl-popup { max-width: 300px; }
  .maplibregl-popup-content { padding: 12px; border-radius: 12px; font-family: sans-serif; background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .maplibregl-ctrl-group { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; }
  .maplibregl-ctrl-group button { border-bottom: 1px solid #f1f5f9 !important; }
`;

const mapStyleObj = {
  version: 8,
  sources: {
    'carto-light-tiles': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors, © CARTO'
    }
  },
  layers: [
    {
      id: 'carto-light-tiles',
      type: 'raster',
      source: 'carto-light-tiles',
      minzoom: 0,
      maxzoom: 20
    }
  ]
};

const MapView = () => {
  const mapRef = useRef(null);
  const {
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedVehicleHistory,
    setSelectedVehicleHistory,
    setVisibleVehiclesCount
  } = useVehicleStore();

  const [pulseRadius, setPulseRadius] = useState(7);

  // Pulse animation using requestAnimationFrame but handled efficiently
  useEffect(() => {
    let animationFrameId;
    let radius = 7;
    let direction = 1;

    const animate = () => {
      radius += direction * 0.25;
      if (radius > 22 || radius < 7) {
        direction *= -1;
      }
      setPulseRadius(radius);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // 1. Fetch history when vehicle is selected
  useEffect(() => {
    if (selectedVehicleId) {
      logger.info(`Fetching coordinates history for ${selectedVehicleId}`);
      vehicleAPI.getVehicleHistory(selectedVehicleId)
        .then((res) => {
          setSelectedVehicleHistory(res.data);

          const currentVehicles = useVehicleStore.getState().vehicles;
          const vObj = currentVehicles.find(v => v.id === selectedVehicleId);
          if (vObj && mapRef.current) {
            mapRef.current.getMap().easeTo({
              center: [vObj.longitude, vObj.latitude],
              zoom: Math.max(14, mapRef.current.getZoom()),
              duration: 1000
            });
          }
        })
        .catch((err) => {
          logger.error(`Failed to load history for ${selectedVehicleId}: ${err.message}`);
        });
    } else {
      setSelectedVehicleHistory([]);
    }
  }, [selectedVehicleId, setSelectedVehicleHistory]);



  const geojsonVehicles = useMemo(() => {
    const features = vehicles.map(vehicle => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [vehicle.longitude, vehicle.latitude] },
      properties: {
        id: vehicle.id,
        name: vehicle.name?.split(' #')[1] ? `#${vehicle.name.split(' #')[1]}` : vehicle.id.substring(0, 5),
        speed: vehicle.speed,
        heading: vehicle.heading,
        status: vehicle.status,
        isOverspeeding: vehicle.speed > 80,
        isSelected: vehicle.id === selectedVehicleId
      }
    }));
    return { type: 'FeatureCollection', features: features.filter(f => !isNaN(f.geometry.coordinates[0]) && !isNaN(f.geometry.coordinates[1])) };
  }, [vehicles, selectedVehicleId]);

  const geojsonHistory = useMemo(() => {
    if (selectedVehicleHistory && selectedVehicleHistory.length > 0) {
      const pathCoordinates = [...selectedVehicleHistory].reverse().map(item => [item.longitude, item.latitude]);
      const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (activeVehicle) {
        pathCoordinates.push([activeVehicle.longitude, activeVehicle.latitude]);
      }
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: pathCoordinates } };
    }
    return { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
  }, [selectedVehicleHistory, vehicles, selectedVehicleId]);

  const onMapClick = useCallback((e) => {
    const feature = e.features && e.features[0];
    if (feature && feature.layer.id === 'vehicle-circles') {
      setSelectedVehicleId(feature.properties.id);
    } else {
      setSelectedVehicleId(null);
    }
  }, [setSelectedVehicleId]);

  const updateVisibleVehicles = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      if (!map) return;
      const bounds = map.getBounds();
      if (bounds) {
        const visible = [];
        const west = bounds.getWest();
        const east = bounds.getEast();
        const south = bounds.getSouth();
        const north = bounds.getNorth();
        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          let inLng = false;
          if (east - west >= 360) {
            inLng = true;
          } else {
            let lng = v.longitude;
            while (lng < west) lng += 360;
            while (lng >= west + 360) lng -= 360;
            if (lng <= east) inLng = true;
          }
          if (
            inLng &&
            v.latitude >= south &&
            v.latitude <= north
          ) {
            visible.push(v);
          }
        }
        useVehicleStore.getState().setVisibleVehicles(visible);
      }
    }
  }, [vehicles]);

  useEffect(() => {
    updateVisibleVehicles();
  }, [updateVisibleVehicles]);

  const onMoveEnd = useCallback(() => {
    updateVisibleVehicles();
  }, [updateVisibleVehicles]);

  const onMouseEnter = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'pointer';
  }, []);

  const onMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
  }, []);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="w-full h-full relative">
      <style>{mapStyles}</style>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 0.0,
          latitude: 20.0,
          zoom: 2
        }}
        mapStyle={mapStyleObj}
        minZoom={1}
        maxZoom={18}
        onClick={onMapClick}
        onMoveEnd={onMoveEnd}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        interactiveLayerIds={['vehicle-circles']}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        <Source id="history-line" type="geojson" data={geojsonHistory}>
          <Layer
            id="history-line-layer"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#0f172a', 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [2, 2] }}
          />
        </Source>

        <Source id="vehicles" type="geojson" data={geojsonVehicles}>
          <Layer
            id="vehicle-pulse"
            type="circle"
            paint={{
              'circle-radius': ['case', ['get', 'isSelected'], pulseRadius, 0],
              'circle-color': '#4f46e5',
              'circle-opacity': 0.3,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#4f46e5'
            }}
          />
          <Layer
            id="vehicle-circles"
            type="circle"
            paint={{
              'circle-color': [
                'case',
                ['get', 'isSelected'], '#000000',
                ['get', 'isOverspeeding'], '#ef4444',
                ['==', ['get', 'status'], 'idle'], '#f59e0b',
                ['==', ['get', 'status'], 'stopped'], '#94a3b8',
                '#10b981'
              ],
              'circle-radius': ['case', ['get', 'isSelected'], 9, 6.5],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }}
          />
          <Layer
            id="vehicle-labels"
            type="symbol"
            minzoom={11}
            layout={{
              'text-field': ['concat', ['get', 'name'], '\n', ['number-format', ['get', 'speed'], { 'max-fraction-digits': 1 }], ' km/h'],
              'text-size': 9.5,
              'text-offset': [0, 1.7],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-ignore-placement': false
            }}
            paint={{ 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }}
          />
        </Source>
      </Map>
      {selectedVehicle && (
        <div className="absolute bottom-6 right-6 z-[1000] drop-shadow-lg">
          <VehiclePopup vehicle={selectedVehicle} onClose={() => setSelectedVehicleId(null)} />
        </div>
      )}
    </div>
  );
};

export default MapView;
