import React from 'react';
import { 
  FiBatteryCharging, 
  FiDroplet, 
  FiNavigation, 
  FiUser, 
  FiMapPin, 
  FiPhoneCall, 
  FiAlertOctagon, 
  FiCompass, 
  FiActivity 
} from 'react-icons/fi';
import { logger } from '../utils/logger';

const VehiclePopup = ({ vehicle, onClose }) => {
  if (!vehicle) return null;

  const getStatusBadge = (status) => {
    switch(status?.toLowerCase()) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'idle': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'stopped': return 'bg-slate-100 text-slate-700 border border-slate-200';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  const handleEmergencyStop = () => {
    logger.warn(`EMERGENCY SHUTDOWN signal sent to vehicle ${vehicle.id} (${vehicle.name})`);
    alert(`EMERGENCY SHUTDOWN protocol initiated for ${vehicle.name}. Speed override cap applied.`);
  };

  const handlePingDriver = () => {
    logger.info(`Pinging driver ${vehicle.driver || 'N/A'} for vehicle ${vehicle.name}`);
    alert(`Pinging driver ${vehicle.driver || 'N/A'}... Communication established.`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 w-80 md:w-96 border border-slate-200 text-slate-800 flex flex-col transition-all duration-300 relative overflow-hidden select-none">
      
      {/* Background Subtle Accent */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-slate-100 rounded-full blur-2xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${getStatusBadge(vehicle.status)}`}>
            {vehicle.status}
          </span>
          <h3 className="text-base font-extrabold text-slate-900 mt-1.5 leading-tight tracking-tight">
            {vehicle.name}
          </h3>
          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
            UID: {vehicle.id}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-lg transition-all"
        >
          ✕
        </button>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        
        {/* Speedometer Dial Graphic */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col justify-center items-center relative overflow-hidden">
          <FiActivity size={18} className="text-slate-400 absolute top-2 right-2 opacity-55" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Telemetry Speed</span>
          <span className={`text-2xl font-black mt-1 ${vehicle.speed > 80 ? 'text-rose-600 animate-pulse font-black' : 'text-slate-900'}`}>
            {vehicle.speed.toFixed(1)}
          </span>
          <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">KM/H</span>
        </div>

        {/* Heading degrees */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col justify-center items-center relative overflow-hidden">
          <FiCompass size={18} className="text-slate-400 absolute top-2 right-2 opacity-55" style={{ transform: `rotate(${vehicle.heading}deg)` }} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compass Heading</span>
          <span className="text-2xl font-black text-slate-900 mt-1">
            {vehicle.heading.toFixed(0)}°
          </span>
          <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
            {vehicle.heading >= 337.5 || vehicle.heading < 22.5 ? 'NORTH' :
             vehicle.heading >= 22.5 && vehicle.heading < 67.5 ? 'NE' :
             vehicle.heading >= 67.5 && vehicle.heading < 112.5 ? 'EAST' :
             vehicle.heading >= 112.5 && vehicle.heading < 157.5 ? 'SE' :
             vehicle.heading >= 157.5 && vehicle.heading < 202.5 ? 'SOUTH' :
             vehicle.heading >= 202.5 && vehicle.heading < 247.5 ? 'SW' :
             vehicle.heading >= 247.5 && vehicle.heading < 292.5 ? 'WEST' : 'NW'}
          </span>
        </div>

      </div>

      {/* Telemetry Detail Lists */}
      <div className="space-y-3 mb-5 border-t border-slate-100 pt-4">
        
        {/* Driver detail */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1.5">
            <FiUser size={13} className="text-slate-500" /> Dispatcher / Driver
          </span>
          <span className="text-slate-900 font-bold">{vehicle.driver || 'Rajesh Kumar'}</span>
        </div>

        {/* Battery Capacity bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1.5">
              <FiBatteryCharging size={13} className="text-emerald-500" /> Battery Capacity
            </span>
            <span className="text-slate-900 font-bold">{vehicle.battery || 80}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${vehicle.battery || 80}%` }}
            ></div>
          </div>
        </div>

        {/* Fuel Volume bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1.5">
              <FiDroplet size={13} className="text-sky-500" /> Fuel Volume
            </span>
            <span className="text-slate-900 font-bold">{vehicle.fuel || 75}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-sky-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${vehicle.fuel || 75}%` }}
            ></div>
          </div>
        </div>

        {/* GPS location coordinates */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1.5">
            <FiMapPin size={13} className="text-rose-500" /> GPS Coordinates
          </span>
          <span className="text-slate-900 font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            {vehicle.latitude.toFixed(5)}, {vehicle.longitude.toFixed(5)}
          </span>
        </div>

      </div>

      {/* Action CTA Buttons */}
      <div className="flex gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
        <button
          onClick={handlePingDriver}
          className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-slate-700 hover:text-slate-900 transition-all active:scale-95"
        >
          <FiPhoneCall size={13} className="text-sky-500" /> Ping Driver
        </button>
        <button
          onClick={handleEmergencyStop}
          className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-rose-700 transition-all active:scale-95"
        >
          <FiAlertOctagon size={13} className="text-rose-600" /> Kill Engine
        </button>
      </div>

    </div>
  );
};

export default VehiclePopup;
