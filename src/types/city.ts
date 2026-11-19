export type CityComponentId =
  | 'eco-residences-west'
  | 'civic-innovation-east'
  | 'solar-farm-ground'
  | 'air-purifier-alpha'
  | 'air-purifier-beta'
  | 'central-eco-park'
  | 'smart-road-grid'
  | 'metro-station-west'
  | 'metro-station-east'
  | 'metro-tunnel-line';

export type LightingMode = 'auto' | 'on' | 'off';
export type CutawayLayerMode = 'cutaway' | 'surface' | 'underground';
export type CameraPreset = 'isometric' | 'underground' | 'aerial' | 'solar';

export interface CitySimulationState {
  timeHour: number; // 0 to 24
  isPlayingTime: boolean;
  timeSpeed: number; // hours per real second
  buildingLights: LightingMode;
  streetlights: LightingMode;
  solarTracking: boolean;
  solarArrayActive: boolean;
  airTowerAlphaRpm: number; // 0 to 100 (%)
  airTowerBetaRpm: number; // 0 to 100 (%)
  parkIrrigation: boolean;
  metroActive: boolean;
  metroSpeedMultiplier: number; // 0.5 to 2.0
  metroStationLights: boolean;
  cutawayMode: CutawayLayerMode;
}

export interface SunEnvironment {
  hour: number;
  phaseLabel: string;
  elevationDeg: number;
  azimuthDeg: number;
  sunPosition: [number, number, number];
  irradiance: number; // 0..1
  isNight: boolean;
  isDuskOrDawn: boolean;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  keyLightHex: string;
  keyLightIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
}

export interface CityMetrics {
  solarGenerationMW: number;
  rooftopSolarMW: number;
  groundSolarMW: number;
  totalDemandMW: number;
  netGridBalanceMW: number;
  batteryChargePct: number;
  airQualityIndex: number; // 0..150 (lower is cleaner)
  pm25UgM3: number;
  co2CapturedTonsDay: number;
  metroPassengersPerHour: number;
  metroHeadwaySec: number;
  parkSoilMoisturePct: number;
  buildingLightsLit: boolean;
  streetlightsLit: boolean;
}

export interface ComponentStat {
  label: string;
  value: string;
  unit?: string;
}

export interface CityComponentDescriptor {
  id: CityComponentId;
  name: string;
  shortName: string;
  category: string;
  level: 'Ground' | 'Underground';
  functionSummary: string;
  capabilities: string[];
  statusLabel: string;
  statusTone: 'optimal' | 'active' | 'standby' | 'boosted';
  focusTarget: [number, number, number];
  cameraOffset: [number, number, number];
  stats: ComponentStat[];
}

export type CityAction =
  | { type: 'SET_TIME'; hour: number }
  | { type: 'SET_TIME_PLAYING'; playing: boolean }
  | { type: 'SET_BUILDING_LIGHTS'; mode: LightingMode }
  | { type: 'SET_STREETLIGHTS'; mode: LightingMode }
  | { type: 'SET_SOLAR_TRACKING'; enabled: boolean }
  | { type: 'SET_SOLAR_ACTIVE'; enabled: boolean }
  | { type: 'SET_AIR_TOWERS_RPM'; rpm: number }
  | { type: 'SET_PARK_IRRIGATION'; enabled: boolean }
  | { type: 'SET_METRO_ACTIVE'; active: boolean }
  | { type: 'SET_METRO_SPEED'; multiplier: number }
  | { type: 'SET_METRO_STATION_LIGHTS'; enabled: boolean }
  | { type: 'SET_CUTAWAY_MODE'; mode: CutawayLayerMode }
  | { type: 'SELECT_COMPONENT'; id: CityComponentId }
  | { type: 'SET_CAMERA_PRESET'; preset: CameraPreset };

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  appliedActions?: string[];
  sourceMode?: 'gemini' | 'local-engine';
}
