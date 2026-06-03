import React, { useState, useEffect, useMemo } from 'react';
import { useVehicleStore } from '../store/useVehicleStore';
import { logger } from '../utils/logger';
import { FiTerminal } from 'react-icons/fi';
import { FaTruck, FaShuttleVan, FaBus, FaCar } from 'react-icons/fa';

const LETrackerLogo = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <rect width="36" height="36" rx="9" fill="url(#logoGradL)" />
    <defs>
      <linearGradient id="logoGradL" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0EA5E9" />
        <stop offset="100%" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <circle cx="18" cy="20" r="3" fill="white" />
    <path d="M13 17 Q18 12 23 17" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M10 14 Q18 7 26 14" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeOpacity="0.55" />
    <path d="M18 23 L18 28" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M6 6 L6 11 M6 6 L11 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M25 6 L30 6 M27.5 6 L27.5 11 M25 8.5 L29 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const statusConfig = {
  active: { color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0", dot: "#22C55E" },
  stopped: { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA", dot: "#EF4444" },
  idle: { color: "#B45309", bg: "#FEF3C7", border: "#FDE68A", dot: "#F59E0B" },
};

const typeIcons = {
  truck: <FaTruck className="text-slate-500" />,
  van: <FaShuttleVan className="text-slate-500" />,
  bus: <FaBus className="text-slate-500" />,
  default: <FaCar className="text-slate-500" />
};

const getStatusConfig = (status) => {
  return statusConfig[status?.toLowerCase()] || { color: "#475569", bg: "#F1F5F9", border: "#E2E8F0", dot: "#94A3B8" };
};

const Sidebar = () => {
  const {
    isConnected,
    latency,
    selectedVehicleId,
    setSelectedVehicleId,
    visibleVehiclesCount,
    visibleVehicles
  } = useVehicleStore();

  const [isOpen, setIsOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, active, idle, stopped
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [systemLogs, setSystemLogs] = useState([]);

  // Subscribe to live system logs
  useEffect(() => {
    const unsubscribe = logger.subscribe((logs) => {
      setSystemLogs(logs.slice(0, 8)); // Last 8 logs
    });
    return unsubscribe;
  }, []);

  // Compute counts and filter vehicles in a single pass
  const { totalCount, activeCount, idleCount, stoppedCount, maxSpeed, filteredVehicles } = useMemo(() => {
    let active = 0, idle = 0, stopped = 0, maxSpd = 0;
    const filtered = [];
    const vils = visibleVehicles || [];
    const term = searchTerm.toLowerCase();

    for (let i = 0; i < vils.length; i++) {
      const v = vils[i];
      if (v.status === 'active') active++;
      else if (v.status === 'idle') idle++;
      else if (v.status === 'stopped') stopped++;

      if (v.speed > maxSpd) maxSpd = v.speed;

      let matchesSearch = true;
      if (term) {
        matchesSearch = v.name?.toLowerCase().includes(term) ||
          String(v.id).toLowerCase().includes(term) ||
          v.driver?.toLowerCase().includes(term);
      }

      if (matchesSearch) {
        if (activeFilter === 'all' ||
          (activeFilter === 'active' && v.status === 'active') ||
          (activeFilter === 'idle' && v.status === 'idle') ||
          (activeFilter === 'stopped' && v.status === 'stopped')) {
          filtered.push(v);
        }
      }
    }

    return {
      totalCount: visibleVehiclesCount,
      activeCount: active,
      idleCount: idle,
      stoppedCount: stopped,
      maxSpeed: maxSpd,
      filteredVehicles: filtered
    };
  }, [visibleVehicles, visibleVehiclesCount, searchTerm, activeFilter]);

  return (
    <div className={`bg-white border-r border-slate-200 flex flex-col h-full text-slate-800 shadow-xl relative select-none z-20 transition-all duration-300 ease-in-out ${isOpen ? 'w-96 min-w-96' : 'w-[64px] min-w-[64px]'}`} style={{ fontFamily: "'DM Mono','Courier New',monospace", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@600;700;800&display=swap');
        .stat-card {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 9px 10px;
          flex: 1; min-width: 0;
          position: relative; overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .stat-card:hover { border-color: #BAE6FD; box-shadow: 0 2px 8px rgba(14,165,233,0.1); }
        .stat-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2.5px;
          background: var(--accent); border-radius: 10px 10px 0 0;
        }

        .vehicle-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px;
          border-bottom: 1px solid #F1F5F9;
          cursor: pointer;
          transition: background 0.15s;
          border-left: 2.5px solid transparent;
        }
        .vehicle-row:hover { background: #F8FAFC; }
        .vehicle-row.selected { background: #EFF6FF; border-left-color: #3B82F6; }

        .search-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 7px;
          padding: 8px 12px;
          color: #475569;
          font-family: 'DM Mono', monospace;
          font-size: 11px; width: 100%; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .search-box:focus { border-color: #93C5FD; box-shadow: 0 0 0 3px rgba(59,130,246,0.08); color: #1E293B; }
        .search-box::placeholder { color: #94A3B8; }

        .filter-btn {
          padding: 4px 9px; border-radius: 5px;
          border: 1px solid #E2E8F0;
          background: transparent;
          color: #94A3B8;
          font-family: 'DM Mono', monospace; font-size: 9.5px;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.05em;
        }
        .filter-btn.active { background: #EFF6FF; border-color: #BFDBFE; color: #2563EB; font-weight: 500; }
        .filter-btn:hover { border-color: #BFDBFE; color: #3B82F6; }

        .pulse-dot { width: 7px; height: 7px; border-radius: 50%; animation: pulse 2s infinite; flex-shrink: 0; }
        @keyframes pulse {
          0%,100% { opacity:1; }
          50% { opacity: 0.5; }
        }

        .ham-btn {
          width: 34px; height: 34px; border-radius: 7px;
          background: #F8FAFC; border: 1px solid #E2E8F0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 4px;
          cursor: pointer; transition: border-color 0.2s, background 0.2s; padding: 0;
          flex-shrink: 0;
        }
        .ham-btn:hover { background: #EFF6FF; border-color: #BFDBFE; }
        .ham-line { width: 15px; height: 1.5px; background: #94A3B8; border-radius: 2px; transition: all 0.3s; }
        .ham-btn:hover .ham-line { background: #3B82F6; }

        .speed-bar { height: 2px; border-radius: 1px; background: #E2E8F0; overflow: hidden; margin-top: 4px; }
        .speed-fill { height: 100%; border-radius: 1px; transition: width 0.5s; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "13px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "10px", minHeight: "62px", background: "#FFFFFF" }}>
        <button className="ham-btn" onClick={() => setIsOpen(!isOpen)}>
          <div className="ham-line" />
          <div className="ham-line" style={{ width: isOpen ? "15px" : "9px" }} />
          <div className="ham-line" />
        </button>
        {isOpen ? (
          <>
            <LETrackerLogo size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: "16px", color: "#0F172A", letterSpacing: "0.06em", lineHeight: 1 }}>
                LE<span style={{ color: "#0000" }}>-</span>TRACKER
              </div>
              <div style={{ fontSize: "8px", color: "#94A3B8", letterSpacing: "0.14em", marginTop: "2px" }}>IOT TELEMETRY ENGINE</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isConnected ? "#22C55E" : "#EF4444", boxShadow: isConnected ? "0 0 5px #22C55E88" : "0 0 5px #EF444488" }} />
              <span style={{ fontSize: "9px", color: isConnected ? "#16A34A" : "#EF4444", fontWeight: 500 }}>{isConnected ? `${latency}ms` : 'Off'}</span>
            </div>
          </>
        ) : (
          <LETrackerLogo size={30} />
        )}
      </div>

      {isOpen && (
        <>
          {/* ── Stats Row — 4 cards in one line ── */}
          <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid #F1F5F9", background: "#FAFBFC" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { label: "TOTAL", value: totalCount, accent: "#0EA5E9", icon: "◈" },
                { label: "ACTIVE", value: activeCount, accent: "#16A34A", icon: "▲" },
                { label: "IDLE", value: idleCount, accent: "#D97706", icon: "◉" },
                { label: "KM/H", value: maxSpeed.toFixed(0), accent: "#7C3AED", icon: "⚡" },
              ].map(({ label, value, accent, icon }) => (
                <div key={label} className="stat-card" style={{ "--accent": accent }}>
                  <div style={{ fontSize: "10px", color: "#000000ff", letterSpacing: "0.1em", marginBottom: "5px", display: "flex", justifyContent: "space-between" }}>
                    <span>{label}</span>
                    <span style={{ color: accent }}>{icon}</span>
                  </div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: "17px", color: accent, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Search + Filter ── */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: "6px", background: "#FFFFFF" }}>
            <input
              className="search-box"
              placeholder="⌕  vehicle, driver or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div style={{ display: "flex", gap: "4px" }}>
              {["ALL", "ACTIVE", "IDLE", "STOPPED"].map((f) => (
                <button key={f} className={`filter-btn ${activeFilter === f.toLowerCase() ? "active" : ""}`} onClick={() => setActiveFilter(f.toLowerCase())}>{f}</button>
              ))}
            </div>
          </div>

          {/* ── Column headers ── */}
          <div style={{ padding: "5px 12px 4px", fontSize: "8px", color: "#4c535bff", letterSpacing: "0.13em", display: "flex", justifyContent: "space-between", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>
            <span>UNIT</span>
            <span>STATUS / SPEED</span>
          </div>

          {/* ── Vehicle List ── */}
          <div style={{ flex: 1, overflowY: "auto", background: "#FFFFFF" }} className="custom-scrollbar">
            {filteredVehicles.length > 0 ? (
              filteredVehicles.slice(0, 100).map((v) => {
                const sc = getStatusConfig(v.status);
                const isSelected = selectedVehicleId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`vehicle-row ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedVehicleId(isSelected ? null : v.id)}
                  >
                    {/* Type icon */}
                    <div style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{typeIcons[v.type?.toLowerCase()] || typeIcons.default}</div>

                    {/* Name / driver / speed bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "10.5px", color: "#1E293B", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                        <span style={{ fontSize: "8px", color: "#CBD5E1", flexShrink: 0 }}>#{String(v.id).replace(/^#/, '')}</span>
                      </div>
                      <div style={{ fontSize: "9px", color: "#94A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.driver || "Unknown Driver"}</div>
                      <div className="speed-bar">
                        <div className="speed-fill" style={{ width: `${Math.min((v.speed / 120) * 100, 100)}%`, background: `linear-gradient(90deg, ${sc.dot}66, ${sc.dot})` }} />
                      </div>
                    </div>

                    {/* Status badge + speed text */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px", flexShrink: 0 }}>
                      <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: "4px", padding: "2px 6px", fontSize: "7.5px", color: sc.color, letterSpacing: "0.07em", fontWeight: 600, textTransform: "uppercase" }}>{v.status}</div>
                      <div style={{ fontSize: "9px", color: "#94A3B8" }}>{v.speed > 0 ? `${v.speed.toFixed(1)} km/h` : "—"}</div>
                    </div>

                    {/* Pulse dot */}
                    <div className="pulse-dot" style={{ background: sc.dot }} />
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "24px 12px", textAlign: "center", color: "#CBD5E1", fontSize: "11px" }}>NO UNITS MATCH</div>
            )}
          </div>

          {/* Collapsible Live Dev Event Terminal (White and Black Aesthetic) */}
          <div className={`bg-slate-50 border-t border-slate-200 transition-all duration-300 flex flex-col ${terminalOpen ? 'h-48' : 'h-10'
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
                      <span className={`font-semibold ${log.level === 'ERROR' ? 'text-rose-600' :
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

        </>
      )}

      {/* ── Collapsed State Icons ── */}
      {!isOpen && (
        <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginTop: "6px", width: "100%" }}>
          {[
            { ic: "◈", c: "#0EA5E9" },
            { ic: "▲", c: "#16A34A" },
            { ic: "◉", c: "#D97706" },
            { ic: "⚡", c: "#7C3AED" },
          ].map(({ ic, c }, i) => (
            <div key={i} style={{ fontSize: "13px", color: c, opacity: 0.5 }}>{ic}</div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Sidebar;

