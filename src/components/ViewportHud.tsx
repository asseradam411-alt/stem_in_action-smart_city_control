import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sun,
} from 'lucide-react';
import {
  CameraPreset,
  CityAction,
  CutawayLayerMode,
  SunEnvironment,
} from '../types/city';
import { formatClockHour } from '../simulation/citySimulation';

interface ViewportHudProps {
  timeHour: number;
  isPlayingTime: boolean;
  sunEnv: SunEnvironment;
  cutawayMode: CutawayLayerMode;
  cameraPreset: CameraPreset;
  onDispatchAction: (action: CityAction) => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
}

const TIME_PRESETS = [
  { label: 'Sunrise', hour: 6.4 },
  { label: 'Noon', hour: 12.2 },
  { label: 'Sunset', hour: 17.8 },
  { label: 'Night', hour: 22.0 },
];

export const ViewportHud: React.FC<ViewportHudProps & { showLabels: boolean; onToggleLabels: () => void }> = ({
  timeHour,
  isPlayingTime,
  sunEnv,
  cutawayMode,
  cameraPreset,
  showLabels,
  onToggleLabels,
  onDispatchAction,
  onSelectCameraPreset,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  return (
    <>
      {/* Top Overlay: Single-Row Brand & Clock | Layer, Labels & Camera Controls */}
      <div className="pointer-events-none absolute top-3.5 left-4 right-4 z-10 flex items-center justify-between gap-3">
        <div className="pointer-events-auto rounded-xl bg-[#0A1120]/92 border border-slate-800/90 px-3.5 py-2 shadow-lg flex items-center gap-2.5 shrink-0">
          <h1 className="font-display text-sm font-bold tracking-tight text-white whitespace-nowrap">
            VerdantGrid 3D
          </h1>
          <span className="text-slate-600" aria-hidden="true">|</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono-num whitespace-nowrap">
            <span>{formatClockHour(timeHour)}</span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-300">{sunEnv.phaseLabel}</span>
          </div>
        </div>

        {/* Layer Cutaway, Labels & Camera Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={onToggleLabels}
            aria-pressed={showLabels}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showLabels
                ? 'bg-[#0A1120]/92 border-cyan-400/45 text-cyan-200'
                : 'bg-[#0A1120]/92 border-slate-800/90 text-slate-300 hover:text-white'
            }`}
          >
            {showLabels ? 'Labels On' : 'Labels Off'}
          </button>

          <div
            className="flex items-center gap-0.5 p-1 rounded-xl bg-[#0A1120]/92 border border-slate-800/90"
            role="group"
            aria-label="City cutaway layers"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400 ml-1.5 mr-1 shrink-0" />
            {(['cutaway', 'surface', 'underground'] as CutawayLayerMode[]).map((mode) => {
              const active = cutawayMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onDispatchAction({ type: 'SET_CUTAWAY_MODE', mode })}
                  className={`px-2 py-1 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                      : 'text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-0.5 p-1 rounded-xl bg-[#0A1120]/92 border border-slate-800/90"
            role="group"
            aria-label="Camera presets"
          >
            {(
              [
                { id: 'isometric', label: 'Isometric' },
                { id: 'underground', label: 'Tunnel' },
                { id: 'aerial', label: 'Plan' },
              ] as { id: CameraPreset; label: string }[]
            ).map((preset) => {
              const active = cameraPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectCameraPreset(preset.id)}
                  className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                      : 'text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSelectCameraPreset('isometric')}
              aria-label="Reset camera view"
              title="Reset camera"
              className="p-1 text-slate-300 hover:text-white rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Collapsible Sun & Time Simulation Dock */}
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="pointer-events-auto mb-1.5 px-3 py-1 rounded-t-lg bg-[#0A1120]/90 border border-b-0 border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Time Controls' : 'Hide Time Controls'}</span>
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-2xl rounded-xl bg-[#0A1120]/92 border border-slate-800 px-4 py-3 shadow-xl space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onDispatchAction({ type: 'SET_TIME_PLAYING', playing: !isPlayingTime })
                  }
                  aria-label={isPlayingTime ? 'Pause sun simulation' : 'Play sun simulation'}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isPlayingTime ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingTime ? 'Pause Cycle' : 'Play Sun Cycle'}</span>
                </button>

                <div className="flex items-center gap-2 text-xs text-slate-300 font-mono-num">
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>{formatClockHour(timeHour)}</span>
                  <span className="text-slate-500">({sunEnv.elevationDeg}°)</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {TIME_PRESETS.map((tp) => (
                  <button
                    key={tp.label}
                    type="button"
                    onClick={() => {
                      onDispatchAction({ type: 'SET_TIME_PLAYING', playing: false });
                      onDispatchAction({ type: 'SET_TIME', hour: tp.hour });
                    }}
                    className="px-2.5 py-1 rounded-md text-xs text-slate-300 hover:text-white bg-[#060B14] border border-slate-800 hover:border-cyan-400/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="sun-time-slider" className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                Solar Time
              </label>
              <input
                id="sun-time-slider"
                type="range"
                min={0}
                max={23.95}
                step={0.05}
                value={timeHour}
                onChange={(e) =>
                  onDispatchAction({ type: 'SET_TIME', hour: Number(e.target.value) })
                }
                className="w-full eng-slider cursor-pointer"
              />
              <span className="text-[11px] font-mono-num text-emerald-400 whitespace-nowrap shrink-0">
                {Math.round(sunEnv.irradiance * 100)}% flux
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
