import React, { useState, useEffect } from 'react';
import { useVehicleStore } from '../store/useVehicleStore';
import { logger } from '../utils/logger';
import { 
  FiActivity, 
  FiWifi, 
  FiSearch, 
  FiAlertTriangle, 
  FiBatteryCharging, 
  FiDroplet, 
  FiUser, 
  FiTerminal,
  FiSlash,
  FiEye,
  FiX
} from 'react-icons/fi';

const Sidebar = () => {
  const { 
    vehicles, 
    isConnected, 
    latency, 
    selectedVehicleId, 
    setSelectedVehicleId 
  } = useVehicleStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, active, idle, stopped, overspeed
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [systemLogs, setSystemLogs] = useState([]);

  // Subscribe to live system logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((logs) => {
      setSystemLogs(logs.slice(0, 8)); // Last 8 logs
    });
    return unsubscribe;
  }, []);

  // Compute counts
  const totalCount = vehicles.length;
  const activeCount = vehicles.filter(v => v.status === 'active').length;
  const idleCount = vehicles.filter(v => v.status === 'idle').length;
  const stoppedCount = vehicles.filter(v => v.status === 'stopped').length;
  const overspeedCount = vehicles.filter(v => v.speed > 80).length;

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.driver?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeFilter === 'active') return v.status === 'active';
    if (activeFilter === 'idle') return v.status === 'idle';
    if (activeFilter === 'stopped') return v.status === 'stopped';
    if (activeFilter === 'overspeed') return v.speed > 80;
    
    return true;
  });

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
      case 'idle': return 'bg-amber-50 text-amber-700 border border-amber-200/80';
      case 'stopped': return 'bg-slate-100 text-slate-700 border border-slate-200/80';
      default: return 'bg-slate-50 text-slate-600 border border-slate-200/80';
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setActiveFilter('all');
  };

  return (
    <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full text-slate-800 shadow-xl relative select-none z-20">
      
      {/* Header and Branding */}
      <div className="p-5 bg-slate-50/80 border-b border-slate-200/80 backdrop-blur-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-white">
              <FiActivity size={18} />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                AUTO-TRACK AI
              </h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                AutoMQ Telemetry Engine
              </p>
            </div>
          </div>
          
          {/* Real-time Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></span>
            <span>{isConnected ? `${latency}ms` : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Grid Stats Block */}
      <div className="p-4 grid grid-cols-2 gap-2 bg-slate-50/30 border-b border-slate-200/80">
        
        {/* Total Vehicles Card */}
        <div 
          onClick={() => setActiveFilter('all')}
          className={`cursor-pointer p-3 rounded-xl border transition-all duration-200 ${
            activeFilter === 'all' 
              ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div className={`text-[10px] uppercase font-bold tracking-wider ${activeFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>Total System</div>
          <div className="text-xl font-extrabold mt-0.5">{totalCount}</div>
        </div>

        {/* Active Vehicles Card */}
        <div 
          onClick={() => setActiveFilter('active')}
          className={`cursor-pointer p-3 rounded-xl border transition-all duration-200 ${
            activeFilter === 'active' 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' 
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300 text-slate-600'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Active</div>
          <div className="text-xl font-extrabold mt-0.5">{activeCount}</div>
        </div>

        {/* Idle Vehicles Card */}
        <div 
          onClick={() => setActiveFilter('idle')}
          className={`cursor-pointer p-3 rounded-xl border transition-all duration-200 ${
            activeFilter === 'idle' 
              ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm' 
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300 text-slate-600'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Idle</div>
          <div className="text-xl font-extrabold mt-0.5">{idleCount}</div>
        </div>

        {/* Overspeed Alerts Card */}
        <div 
          onClick={() => setActiveFilter('overspeed')}
          className={`cursor-pointer p-3 rounded-xl border transition-all duration-200 ${
            activeFilter === 'overspeed' 
              ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm animate-pulse' 
              : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/50 hover:border-slate-300 text-slate-600'
          }`}
        >
          <div className="text-[10px] uppercase font-bold tracking-wider text-rose-500 flex items-center gap-1">
            Speed <FiAlertTriangle size={11} />
          </div>
          <div className="text-xl font-extrabold mt-0.5">{overspeedCount}</div>
        </div>

      </div>

      {/* Search Input Bar */}
      <div className="p-4 bg-slate-50/20 border-b border-slate-200/80">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <FiSearch size={15} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vehicle, driver or ID..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400 transition-all"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <FiX size={15} />
            </button>
          )}
        </div>
        
        {/* Clear Search & Filter Helper Banner */}
        {(searchTerm || activeFilter !== 'all') && (
          <div className="flex justify-between items-center mt-3 text-xs">
            <span className="text-slate-500">
              Showing {filteredVehicles.length} of {totalCount}
            </span>
            <button 
              onClick={clearFilters}
              className="text-slate-900 hover:text-slate-700 font-bold flex items-center gap-1"
            >
              <FiSlash size={11} /> Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Main Vehicle Stream List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/10">
        {filteredVehicles.length > 0 ? (
          filteredVehicles.slice(0, 100).map((vehicle) => {
            const isSelected = vehicle.id === selectedVehicleId;
            return (
              <div 
                key={vehicle.id} 
                onClick={() => setSelectedVehicleId(vehicle.id)}
                className={`group p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? 'bg-white border-slate-900 shadow-md ring-1 ring-slate-900' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-sm font-bold tracking-tight transition-colors ${
                      isSelected ? 'text-slate-900' : 'text-slate-800'
                    }`}>
                      {vehicle.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
                      <FiUser className="text-slate-400" />
                      <span>{vehicle.driver}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusColor(vehicle.status)}`}>
                    {vehicle.status}
                  </span>
                </div>

                {/* Battery and Fuel Telemetry */}
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <FiBatteryCharging className="text-emerald-500" size={13} />
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${vehicle.battery || 80}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold">{vehicle.battery || 80}%</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <FiDroplet className="text-sky-500" size={12} />
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${vehicle.fuel || 75}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold">{vehicle.fuel || 75}%</span>
                  </div>
                </div>

                {/* Speed & Heading details */}
                <div className="flex justify-between items-center text-xs mt-3 bg-slate-50 p-2 rounded-lg text-slate-600 border border-slate-100">
                  <span className="flex items-center gap-1 font-semibold">
                    <span className="text-slate-400 font-medium">Speed:</span> 
                    <span className={vehicle.speed > 80 ? 'text-rose-600 font-extrabold animate-pulse' : 'text-slate-800'}>
                      {vehicle.speed.toFixed(1)} km/h
                    </span>
                  </span>
                  
                  <span className="text-[10px] font-mono text-slate-400">
                    {vehicle.latitude.toFixed(4)}, {vehicle.longitude.toFixed(4)}
                  </span>
                </div>

              </div>
            );
          })
        ) : (
          <div className="text-center text-slate-400 py-12 italic text-sm">
            No telemetry records match filters.
          </div>
        )}
      </div>

      {/* Collapsible Live Dev Event Terminal (White and Black Aesthetic) */}
      <div className={`bg-slate-50 border-t border-slate-200 transition-all duration-300 flex flex-col ${
        terminalOpen ? 'h-48' : 'h-10'
      }`}>
        <div 
          onClick={() => setTerminalOpen(!terminalOpen)}
          className="flex justify-between items-center px-4 py-2 bg-slate-100 border-b border-slate-200/80 cursor-pointer text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FiTerminal className="text-slate-800" />
            <span className="tracking-wide">SYSTEM TELEMETRY LOGS</span>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            {terminalOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {terminalOpen && (
          <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-1 bg-white custom-scrollbar select-text selection:bg-slate-200 border-none">
            {systemLogs.length > 0 ? (
              systemLogs.map((log) => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-slate-400 font-semibold">[{log.timestamp}]</span>
                  <span className={`font-semibold ${
                    log.level === 'ERROR' ? 'text-rose-600' :
                    log.level === 'WARN' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-slate-600">{log.message}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-400 italic">Listening for telemetry/websocket system packets...</div>
            )}
            <div className="flex items-center gap-1 text-slate-800 text-xs mt-1 animate-pulse">
              <span>$</span>
              <span className="w-1.5 h-3.5 bg-slate-800 rounded-sm"></span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Sidebar;
