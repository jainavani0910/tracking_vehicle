import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useVehicleStore } from '../store/useVehicleStore';
import VehiclePopup from './VehiclePopup';
import { subscribeToViewport } from '../services/socket';
import apiClient, { vehicleAPI } from '../services/api';
import { logger } from '../utils/logger';

const MapView = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('mapThemeIsDarkMode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [isSatellite, setIsSatellite] = useState(() => {
    try {
      const saved = localStorage.getItem('mapThemeIsSatellite');
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  useEffect(() => {
    localStorage.setItem('mapThemeIsDarkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('mapThemeIsSatellite', JSON.stringify(isSatellite));
  }, [isSatellite]);
  const mapRef = useRef(null);
  
  const isDarkTheme = isDarkMode || isSatellite;

  const mapStyles = `
    .maplibregl-popup { max-width: 300px; }
    .maplibregl-popup-content { padding: 12px; border-radius: 12px; font-family: sans-serif; background: ${isDarkTheme ? '#1e293b' : '#ffffff'}; color: ${isDarkTheme ? '#f8fafc' : '#0f172a'}; border: 1px solid ${isDarkTheme ? '#334155' : '#e2e8f0'}; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .maplibregl-ctrl-group { background: ${isDarkTheme ? '#1e293b' : '#ffffff'} !important; border: 1px solid ${isDarkTheme ? '#334155' : '#e2e8f0'} !important; border-radius: 8px !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important; }
    .maplibregl-ctrl-group button { border-bottom: 1px solid ${isDarkTheme ? '#334155' : '#f1f5f9'} !important; filter: ${isDarkTheme ? 'invert(1) hue-rotate(180deg)' : 'none'}; }
  `;

  const mapStyleObj = useMemo(() => {
    let tiles = [];
    if (isSatellite) {
      tiles = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];
    } else if (isDarkMode) {
      tiles = [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ];
    } else {
      tiles = [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
      ];
    }

    return {
      version: 8,
      sources: {
        'carto-tiles': {
          type: 'raster',
          tiles: tiles,
          tileSize: 256,
          attribution: isSatellite ? '© Esri' : '© OpenStreetMap contributors, © CARTO'
        }
      },
      layers: [
        {
          id: 'carto-tiles',
          type: 'raster',
          source: 'carto-tiles',
          minzoom: 0,
          maxzoom: 20
        }
      ]
    };
  }, [isDarkMode, isSatellite]);
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
    if (!feature) {
      setSelectedVehicleId(null);
      return;
    }

    if (feature.layer.id === 'clusters') {
      const clusterId = feature.properties.cluster_id;
      const map = mapRef.current.getMap();
      const source = map.getSource('vehicles');

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: feature.geometry.coordinates,
          zoom: zoom,
          duration: 500
        });
      });
      return;
    }

    if (feature.layer.id === 'vehicle-circles') {
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
        const normWest = ((west + 180) % 360 + 360) % 360 - 180;
        const normEast = ((east + 180) % 360 + 360) % 360 - 180;

        for (let i = 0; i < vehicles.length; i++) {
          const v = vehicles[i];
          let inLng = false;

          if (east - west >= 360) {
            inLng = true;
          } else if (normWest <= normEast) {
            inLng = v.longitude >= normWest && v.longitude <= normEast;
          } else {
            inLng = v.longitude >= normWest || v.longitude <= normEast;
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
  if (mapRef.current) {
    const bounds = mapRef.current.getMap().getBounds();

    subscribeToViewport({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }

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
        interactiveLayerIds={['vehicle-circles', 'clusters']}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        <Source id="history-line" type="geojson" data={geojsonHistory}>
          <Layer
            id="history-line-layer"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': isDarkTheme ? '#e2e8f0' : '#0f172a', 'line-width': 2.5, 'line-opacity': 0.75, 'line-dasharray': [2, 2] }}
          />
        </Source>

        <Source
          id="vehicles"
          type="geojson"
          data={geojsonVehicles}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                isDarkTheme ? '#6366f1' : '#4f46e5', // Base color for < 100
                100,
                isDarkTheme ? '#3b82f6' : '#3b82f6', // Color for 100-750
                750,
                isDarkTheme ? '#2563eb' : '#2563eb'  // Color for >= 750
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,  // Radius for < 100
                100,
                30,  // Radius for 100-750
                750,
                40   // Radius for >= 750
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': isDarkTheme ? '#1e293b' : '#ffffff'
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-size': 14,
              'text-allow-overlap': true
            }}
            paint={{
              'text-color': '#ffffff'
            }}
          />
          <Layer
            id="vehicle-pulse"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-radius': ['case', ['get', 'isSelected'], pulseRadius, 0],
              'circle-color': isDarkTheme ? '#818cf8' : '#4f46e5',
              'circle-opacity': 0.3,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': isDarkTheme ? '#818cf8' : '#4f46e5'
            }}
          />
          <Layer
            id="vehicle-circles"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': [
                'case',
                ['get', 'isSelected'], isDarkTheme ? '#ffffff' : '#000000',
                ['get', 'isOverspeeding'], '#ef4444',
                ['==', ['get', 'status'], 'idle'], '#f59e0b',
                ['==', ['get', 'status'], 'stopped'], '#94a3b8',
                '#10b981'
              ],
              'circle-radius': ['case', ['get', 'isSelected'], 9, 6.5],
              'circle-stroke-width': 2,
              'circle-stroke-color': isDarkTheme ? '#1e293b' : '#ffffff'
            }}
          />
          <Layer
            id="vehicle-labels"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            minzoom={11}
            layout={{
              'text-field': ['concat', ['get', 'name'], '\n', ['number-format', ['get', 'speed'], { 'max-fraction-digits': 1 }], ' km/h'],
              'text-size': 9.5,
              'text-offset': [0, 1.7],
              'text-anchor': 'top',
              'text-allow-overlap': false,
              'text-ignore-placement': false
            }}
            paint={{ 'text-color': isDarkTheme ? '#e2e8f0' : '#0f172a', 'text-halo-color': isDarkTheme ? '#0f172a' : '#ffffff', 'text-halo-width': 2 }}
          />
        </Source>
      </Map>
      {selectedVehicle && (
        <div className="absolute bottom-6 right-6 z-[1000] drop-shadow-lg">
          <VehiclePopup vehicle={selectedVehicle} onClose={() => setSelectedVehicleId(null)} />
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Satellite Toggle Button */}
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          className={`p-2 rounded-lg shadow-md transition-colors ${
            isSatellite ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
          title="Toggle Satellite View"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={() => {
            setIsDarkMode(!isDarkMode);
            if (isSatellite) setIsSatellite(false);
          }}
          className={`p-2 rounded-lg shadow-md transition-colors ${
            isDarkMode && !isSatellite ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
          title="Toggle Map Theme"
        >
          {isDarkMode && !isSatellite ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default MapView;
