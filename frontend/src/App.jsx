import { useEffect, useState } from 'react';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import { initializeSocket, disconnectSocket } from './services/socket';
import { healthCheck } from './services/api';
import { logger } from './utils/logger';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';

function App() {
  const [isServerHealthy, setIsServerHealthy] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const checkConnectionAndStart = async () => {
    setConnecting(true);
    logger.info('Performing system backend health diagnostic...');
    try {
      await healthCheck();
      logger.info('System health status: ONLINE. Starting telemetry streams.');
      setIsServerHealthy(true);
      setConnecting(false);
      
      // Initialize Socket.IO connection
      initializeSocket();
    } catch (err) {
      logger.error(`Health diagnostic failed: ${err.message}. Retrying in 5 seconds...`);
      setIsServerHealthy(false);
      setConnecting(false);
      
      // Schedule automatic retry
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, 5000);
    }
  };

  useEffect(() => {
    checkConnectionAndStart();

    return () => {
      disconnectSocket();
    };
  }, [retryCount]);

  return (
    <div className="w-screen h-screen flex flex-col font-sans bg-white text-slate-800 overflow-hidden">
      
      {/* Main Core Layout Grid */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        
        {/* Control sidebar */}
        <Sidebar />
        
        {/* Map View Canvas Panel */}
        <div className="flex-1 flex overflow-hidden relative">
          <MapView />

          {/* Connected/Disconnected Server Health Status Banners */}
          {(!isServerHealthy || connecting) && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col justify-center items-center z-[99999] p-6 text-center select-none">
              <div className="bg-white border border-slate-200 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col items-center">
                
                {/* Glowing alert icon */}
                <div className="p-4 bg-rose-50 rounded-2xl text-white mb-5">
                  <FiWifiOff size={32} />
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">
                  Telemetry Engine Down
                </h2>
                
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                  Unable to establish heartbeat connection with the telemetry gateway at <code className="bg-slate-50 px-2 py-1 rounded text-rose-600 border border-slate-200">http://localhost:3000</code>.
                </p>

                {connecting ? (
                  <div className="flex items-center gap-2 text-slate-800 text-sm font-semibold">
                    <FiRefreshCw className="animate-spin" size={16} />
                    <span>Resolving telemetry handshakes...</span>
                  </div>
                ) : (
                  <div className="space-y-4 w-full">
                    <div className="text-xs text-slate-400 font-medium">
                      Next auto-retry diagnostic in 5 seconds (Attempt #{retryCount + 1})
                    </div>
                    <button 
                      onClick={() => setRetryCount(prev => prev + 1)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                    >
                      <FiRefreshCw size={14} /> Retry Gateway Audit
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default App;
