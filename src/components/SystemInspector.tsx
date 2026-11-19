import React from 'react';
import {
  Building2,
  Cpu,
  Layers,
  Leaf,
  Lightbulb,
  Sun,
  TrainFront,
  Wind,
  Droplets,
  Gauge,
} from 'lucide-react';
import {
  CityAction,
  CityComponentId,
  CityMetrics,
  CitySimulationState,
  LightingMode,
} from '../types/city';
import {
  COMPONENT_ORDER,
  getComponentDetails,
} from '../simulation/citySimulation';

interface SystemInspectorProps {
  selectedComponentId: CityComponentId;
  simulationState: CitySimulationState;
  metrics: CityMetrics;
  onSelectComponent: (id: CityComponentId) => void;
  onDispatchAction: (action: CityAction) => void;
}

const COMPONENT_ICONS: Record<CityComponentId, React.ReactNode> = {
  'eco-residences-west': <Building2 className="w-3.5 h-3.5" />,
  'civic-innovation-east': <Building2 className="w-3.5 h-3.5" />,
  'solar-farm-ground': <Sun className="w-3.5 h-3.5" />,
  'air-purifier-alpha': <Wind className="w-3.5 h-3.5" />,
  'air-purifier-beta': <Wind className="w-3.5 h-3.5" />,
  'central-eco-park': <Leaf className="w-3.5 h-3.5" />,
  'smart-road-grid': <Lightbulb className="w-3.5 h-3.5" />,
  'metro-station-west': <TrainFront className="w-3.5 h-3.5" />,
  'metro-station-east': <TrainFront className="w-3.5 h-3.5" />,
  'metro-tunnel-line': <Layers className="w-3.5 h-3.5" />,
};

export const SystemInspector: React.FC<SystemInspectorProps> = ({
  selectedComponentId,
  simulationState,
  metrics,
  onSelectComponent,
  onDispatchAction,
}) => {
  const details = getComponentDetails(selectedComponentId, simulationState, metrics);

  const statusColor =
    details.statusTone === 'optimal'
      ? 'text-emerald-400'
      : details.statusTone === 'boosted'
        ? 'text-cyan-300'
        : details.statusTone === 'active'
          ? 'text-sky-300'
          : 'text-slate-400';

  const renderLightingSegmented = (
    label: string,
    currentMode: LightingMode,
    actionType: 'SET_BUILDING_LIGHTS' | 'SET_STREETLIGHTS',
  ) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono-num text-cyan-300 capitalize">{currentMode}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#060B14] border border-slate-800">
        {(['auto', 'on', 'off'] as LightingMode[]).map((mode) => {
          const active = currentMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onDispatchAction({ type: actionType, mode })}
              className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto eng-scroll p-4 space-y-5">
      {/* Component Directory Selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-slate-400">City Systems Directory</h3>
          <span className="text-xs text-slate-500 font-mono-num">10 nodes</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {COMPONENT_ORDER.map((id) => {
            const desc = getComponentDetails(id, simulationState, metrics);
            const selected = id === selectedComponentId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectComponent(id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors border cursor-pointer ${
                  selected
                    ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-100'
                    : 'bg-[#0D1526] border-slate-800/90 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className={selected ? 'text-cyan-300 shrink-0' : 'text-emerald-400/80 shrink-0'}>
                  {COMPONENT_ICONS[id]}
                </span>
                <span className="truncate font-medium">{desc.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Component Specification */}
      <section
        className="rounded-xl bg-[#0D1526] border border-slate-800 p-4 space-y-3.5"
        aria-label="Selected component details"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{details.level} Level</span>
              <span aria-hidden="true">·</span>
              <span>{details.category}</span>
            </div>
            <h2 className="font-display text-base font-semibold text-white mt-0.5 leading-snug">
              {details.name}
            </h2>
          </div>
          <span className={`text-xs font-mono-num font-medium shrink-0 ${statusColor}`}>
            {details.statusLabel}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          {details.functionSummary}
        </p>

        {/* Live Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {details.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-[#070C17] border border-slate-800/80 px-3 py-2"
            >
              <div className="text-[11px] text-slate-400 truncate">{stat.label}</div>
              <div className="font-mono-num text-sm font-semibold text-slate-100 mt-0.5">
                {stat.value}
                {stat.unit && (
                  <span className="text-[11px] font-normal text-cyan-400/80 ml-1">
                    {stat.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Capabilities */}
        <div className="pt-1 border-t border-slate-800/80">
          <h4 className="text-xs font-medium text-slate-300 mb-2">System Capabilities</h4>
          <ul className="space-y-1.5">
            {details.capabilities.map((cap) => (
              <li key={cap} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5 shrink-0">-</span>
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Interactive Engineering Controls for Selected Component */}
      <section
        className="rounded-xl bg-[#0D1526] border border-slate-800 p-4 space-y-4"
        aria-label="System controls"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display text-sm font-semibold text-white">
              System Controls
            </h3>
          </div>
          <span className="text-xs text-slate-400">{details.shortName}</span>
        </div>

        {(selectedComponentId === 'eco-residences-west' ||
          selectedComponentId === 'civic-innovation-east') && (
          <div className="space-y-3">
            {renderLightingSegmented(
              'Building Interior Lighting',
              simulationState.buildingLights,
              'SET_BUILDING_LIGHTS',
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-300">Rooftop Solar Tracking</span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_SOLAR_TRACKING',
                    enabled: !simulationState.solarTracking,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.solarTracking
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.solarTracking ? 'Tracking Enabled' : 'Fixed Angle'}
              </button>
            </div>
          </div>
        )}

        {selectedComponentId === 'solar-farm-ground' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Microgrid Array Status</span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_SOLAR_ACTIVE',
                    enabled: !simulationState.solarArrayActive,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.solarArrayActive
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.solarArrayActive ? 'Array Online' : 'Standby'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Dual-Axis Sun Tracking</span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_SOLAR_TRACKING',
                    enabled: !simulationState.solarTracking,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.solarTracking
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.solarTracking ? 'Sun Lock Active' : 'Fixed Tilt'}
              </button>
            </div>
          </div>
        )}

        {(selectedComponentId === 'air-purifier-alpha' ||
          selectedComponentId === 'air-purifier-beta') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="air-rpm-slider" className="text-slate-300">
                Scrubber Turbine Speed
              </label>
              <span className="font-mono-num text-cyan-300">
                {selectedComponentId === 'air-purifier-alpha'
                  ? simulationState.airTowerAlphaRpm
                  : simulationState.airTowerBetaRpm}
                %
              </span>
            </div>
            <input
              id="air-rpm-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={
                selectedComponentId === 'air-purifier-alpha'
                  ? simulationState.airTowerAlphaRpm
                  : simulationState.airTowerBetaRpm
              }
              onChange={(e) =>
                onDispatchAction({
                  type: 'SET_AIR_TOWERS_RPM',
                  rpm: Number(e.target.value),
                })
              }
              className="w-full eng-slider cursor-pointer"
            />
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Idle', rpm: 0 },
                { label: 'Eco 45%', rpm: 45 },
                { label: 'Boost 95%', rpm: 95 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onDispatchAction({ type: 'SET_AIR_TOWERS_RPM', rpm: preset.rpm })
                  }
                  className="py-1.5 px-2 text-xs rounded-lg bg-[#060B14] border border-slate-700 hover:border-cyan-400/50 text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedComponentId === 'central-eco-park' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Smart Drip Irrigation</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_PARK_IRRIGATION',
                    enabled: !simulationState.parkIrrigation,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.parkIrrigation
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.parkIrrigation ? 'Irrigation Active' : 'Start Irrigation'}
              </button>
            </div>
          </div>
        )}

        {selectedComponentId === 'smart-road-grid' && (
          <div className="space-y-3">
            {renderLightingSegmented(
              'Avenue LED Streetlights',
              simulationState.streetlights,
              'SET_STREETLIGHTS',
            )}
          </div>
        )}

        {(selectedComponentId === 'metro-station-west' ||
          selectedComponentId === 'metro-station-east' ||
          selectedComponentId === 'metro-tunnel-line') && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Underground Metro Dispatch</span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_METRO_ACTIVE',
                    active: !simulationState.metroActive,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.metroActive
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.metroActive ? 'Trains Running' : 'Trains Paused'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="metro-speed-slider" className="text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Line Speed Multiplier</span>
                </label>
                <span className="font-mono-num text-cyan-300">
                  {simulationState.metroSpeedMultiplier.toFixed(2)}x
                </span>
              </div>
              <input
                id="metro-speed-slider"
                type="range"
                min={0.5}
                max={2.0}
                step={0.25}
                value={simulationState.metroSpeedMultiplier}
                onChange={(e) =>
                  onDispatchAction({
                    type: 'SET_METRO_SPEED',
                    multiplier: Number(e.target.value),
                  })
                }
                className="w-full eng-slider cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Station Concourse Lights</span>
              <button
                type="button"
                onClick={() =>
                  onDispatchAction({
                    type: 'SET_METRO_STATION_LIGHTS',
                    enabled: !simulationState.metroStationLights,
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  simulationState.metroStationLights
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                    : 'bg-[#060B14] border-slate-700 text-slate-300'
                }`}
              >
                {simulationState.metroStationLights ? 'Lights On' : 'Dimmed'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
