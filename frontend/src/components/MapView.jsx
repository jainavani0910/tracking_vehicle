import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useVehicleStore } from '../store/useVehicleStore';
import VehiclePopup from './VehiclePopup';
import { subscribeToViewport } from '../services/socket';
import apiClient, { vehicleAPI } from '../services/api';
import { logger } from '../utils/logger';

const mapStyles = `
  .maplibregl-popup { max-width: 300px; }
  .maplibregl-popup-content { padding: 12px; border-radius: 12px; font-family: sans-serif; background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .maplibregl-ctrl-group { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; }
  .maplibregl-ctrl-group button { border-bottom: 1px solid #f1f5f9 !important; }
`;

// Conversion functions for Web Mercator tile calculations
const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
const lat2tile = (lat, zoom) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

const MapView = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const { 
    vehicles, 
    selectedVehicleId, 
    setSelectedVehicleId, 
    selectedVehicleHistory, 
    setSelectedVehicleHistory 
  } = useVehicleStore();

  const selectedVehicleIdRef = useRef(null);
  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  // 1. Fetch history when vehicle is selected
  useEffect(() => {
    if (selectedVehicleId) {
      logger.info(`Fetching coordinates history for ${selectedVehicleId}`);
      vehicleAPI.getVehicleHistory(selectedVehicleId)
        .then((res) => {
          setSelectedVehicleHistory(res.data);
          
          // Find selected vehicle and gently pan map to center
          const vObj = vehicles.find(v => v.id === selectedVehicleId);
          if (vObj && map.current) {
            map.current.easeTo({
              center: [vObj.longitude, vObj.latitude],
              zoom: Math.max(14, map.current.getZoom()),
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
  }, [selectedVehicleId]);

  // 2. Initialize MapLibre
  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    logger.info('Initializing MapLibre engine with CartoDB Positron...');

    // Open source CartoDB Positron layer (Premium minimal light-mode aesthetic)
    const mapStyle = {
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

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [80.0, 22.0], // India center
      zoom: 5,
      maxZoom: 18,
      minZoom: 2,
      trackResize: true
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const sendViewport = () => {
      if (!map.current) return;

      const bounds = map.current.getBounds();
      const zoom = Math.floor(map.current.getZoom());

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const minX = Math.max(0, lon2tile(sw.lng, zoom));
      const maxX = Math.min(Math.pow(2, zoom) - 1, lon2tile(ne.lng, zoom));
      const minY = Math.max(0, lat2tile(ne.lat, zoom));
      const maxY = Math.min(Math.pow(2, zoom) - 1, lat2tile(sw.lat, zoom));

      const tiles = [];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push(`${zoom}/${x}/${y}`);
        }
      }

      logger.info(`Viewport changed. Subscribing to ${tiles.length} map tiles...`);
      subscribeToViewport({
        zoom,
        tiles
      });
    };

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.on('error', (e) => {
        logger.error(`MapLibre Error: ${e.error?.message || e.error || 'Unknown rendering error'}`);
      });

      // 1. Add History Vector Line Source & Layer (Dashed Indigo Path Line)
      map.current.addSource('history-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      map.current.addLayer({
        id: 'history-line-layer',
        type: 'line',
        source: 'history-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0f172a', // Solid Dark Charcoal/Black history trail
          'line-width': 2.5,
          'line-opacity': 0.75,
          'line-dasharray': [2, 2] // Dashed visual style
        }
      });

      // 2. Add GeoJSON Vehicles Source
      map.current.addSource('vehicles', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // 3. Circle Pulsing Selected Ring (Clean Dark Indigo pulse)
      map.current.addLayer({
        id: 'vehicle-pulse',
        type: 'circle',
        source: 'vehicles',
        paint: {
          'circle-radius': 0, 
          'circle-color': '#4f46e5',
          'circle-opacity': 0.3,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#4f46e5'
        }
      });

      // 4. Circle Vehicle Bodies Layer (Tailored for White/Black/Light palette)
      map.current.addLayer({
        id: 'vehicle-circles',
        type: 'circle',
        source: 'vehicles',
        paint: {
          'circle-color': [
            'case',
            ['get', 'isSelected'],
            '#000000', // Selected: Jet Black
            ['get', 'isOverspeeding'],
            '#ef4444', // Overspeeding: Warning Red
            ['==', ['get', 'status'], 'idle'],
            '#f59e0b', // Idle: Amber
            ['==', ['get', 'status'], 'stopped'],
            '#94a3b8', // Stopped: Muted Gray
            '#10b981'  // Active: Vibrant Emerald Green
          ],
          'circle-radius': [
            'case',
            ['get', 'isSelected'],
            9,
            6.5
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // 5. Text label layer (High contrast charcoal text with pure white halos)
      map.current.addLayer({
        id: 'vehicle-labels',
        type: 'symbol',
        source: 'vehicles',
        minzoom: 11,
        layout: {
          'text-field': ['concat', ['get', 'name'], '\n', ['number-format', ['get', 'speed'], { 'max-fraction-digits': 1 }], ' km/h'],
          'text-size': 9.5,
          'text-offset': [0, 1.7],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      });

      // Click handler
      map.current.on('click', 'vehicle-circles', (e) => {
        if (e.features && e.features.length > 0) {
          const properties = e.features[0].properties;
          setSelectedVehicleId(properties.id);
        }
      });

      map.current.on('mouseenter', 'vehicle-circles', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'vehicle-circles', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Fetch initial vehicles from API immediately
      const fetchInitialVehicles = async () => {
        try {
          logger.info('Fetching all vehicles from backend...');
          const response = await apiClient.get('/api/vehicles');
          const vehiclesData = response.data || [];
          logger.info(`Loaded ${vehiclesData.length} vehicles from backend`);
          if (vehiclesData.length > 0) {
            const store = useVehicleStore.getState();
            store.setVehicles(vehiclesData);
            logger.info(`Store updated with ${vehiclesData.length} vehicles`);
          } else {
            logger.warn('No vehicles returned from backend');
          }
        } catch (err) {
          logger.error(`Failed to fetch initial vehicles: ${err.message}`);
        }
      };

      // Fetch initial vehicles and then send viewport subscription
      fetchInitialVehicles().then(() => {
        sendViewport();
      });
      
      animatePulse();
    });

    map.current.on('moveend', sendViewport);

    map.current.on('click', (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['vehicle-circles'] });
      if (!features || features.length === 0) {
        setSelectedVehicleId(null);
      }
    });

    // WebGL circle pulse animation
    let pulseRadius = 7;
    let pulseDirection = 1;
    const animatePulse = () => {
      if (!map.current) return;
      
      const layerExists = map.current.getLayer('vehicle-pulse');
      if (layerExists) {
        pulseRadius += pulseDirection * 0.25;
        if (pulseRadius > 22 || pulseRadius < 7) {
          pulseDirection *= -1;
        }

        map.current.setPaintProperty('vehicle-pulse', 'circle-radius', [
          'case',
          ['get', 'isSelected'],
          pulseRadius,
          0
        ]);
      }

      requestAnimationFrame(animatePulse);
    };

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update GeoJSON features on telemetry streams
  useEffect(() => {
    if (!map.current) return;

    const source = map.current.getSource('vehicles');
    if (!source) return;

    const geojsonFeatures = vehicles.map(vehicle => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [vehicle.longitude, vehicle.latitude]
      },
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

    const validFeatures = geojsonFeatures.filter(f => !isNaN(f.geometry.coordinates[0]) && !isNaN(f.geometry.coordinates[1]));
    if (validFeatures.length !== geojsonFeatures.length) {
      logger.warn(`Filtered out ${geojsonFeatures.length - validFeatures.length} invalid vehicle coordinates.`);
    }

    source.setData({
      type: 'FeatureCollection',
      features: validFeatures
    });
  }, [vehicles, selectedVehicleId]);

  // Update history GeoJSON Line coordinates
  useEffect(() => {
    if (!map.current) return;

    const lineSource = map.current.getSource('history-line');
    if (!lineSource) return;

    if (selectedVehicleHistory && selectedVehicleHistory.length > 0) {
      // Reverse history data (which is reverse chronological from Redis lPush) to chronological
      const pathCoordinates = [...selectedVehicleHistory]
        .reverse()
        .map(item => [item.longitude, item.latitude]);

      // If active, prepend current coordinates so line connects smoothly to the vehicle marker
      const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (activeVehicle) {
        pathCoordinates.push([activeVehicle.longitude, activeVehicle.latitude]);
      }

      lineSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: pathCoordinates
        }
      });
    } else {
      lineSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
    }
  }, [selectedVehicleHistory, vehicles, selectedVehicleId]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="w-full h-full relative">
      <style>{mapStyles}</style>
      <div ref={mapContainer} className="w-full h-full z-[1]" />
      {selectedVehicle && (
        <div className="absolute bottom-6 right-6 z-[1000] drop-shadow-lg">
          <VehiclePopup vehicle={selectedVehicle} onClose={() => setSelectedVehicleId(null)} />
        </div>
      )}
    </div>
  );
};

export default MapView;
