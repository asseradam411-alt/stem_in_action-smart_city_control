import {
  CityAction,
  CityComponentDescriptor,
  CityComponentId,
  CityMetrics,
  CitySimulationState,
  SunEnvironment,
} from '../types/city';

export const DEFAULT_SIMULATION_STATE: CitySimulationState = {
  timeHour: 13.5, // Early afternoon sun for vivid initial 3D lighting
  isPlayingTime: false,
  timeSpeed: 0.45,
  buildingLights: 'auto',
  streetlights: 'auto',
  solarTracking: true,
  solarArrayActive: true,
  airTowerAlphaRpm: 72,
  airTowerBetaRpm: 65,
  parkIrrigation: false,
  metroActive: true,
  metroSpeedMultiplier: 1.0,
  metroStationLights: true,
  cutawayMode: 'cutaway',
};

export const COMPONENT_ORDER: CityComponentId[] = [
  'eco-residences-west',
  'civic-innovation-east',
  'solar-farm-ground',
  'air-purifier-alpha',
  'air-purifier-beta',
  'central-eco-park',
  'smart-road-grid',
  'metro-station-west',
  'metro-station-east',
  'metro-tunnel-line',
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const k = clamp(t, 0, 1);
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(lerp(r1, r2, k), lerp(g1, g2, k), lerp(b1, b2, k));
}

export function formatClockHour(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.floor((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function computeSunState(rawHour: number): SunEnvironment {
  const hour = ((rawHour % 24) + 24) % 24;
  // Sunrise at 06:00, Solar Noon at 12:00, Sunset at 18:00
  const dayAngle = ((hour - 6) / 12) * Math.PI; // 0 at 6am, PI/2 at noon, PI at 6pm
  const sinElev = Math.sin(dayAngle);
  const elevationDeg = clamp(sinElev * 72, -45, 72);
  const elevationRad = (elevationDeg * Math.PI) / 180;

  // Sun sweeps from East (+X) through high South-Back (-Z/+Y) to West (-X) across the visible sky dome
  const orbitRadius = 32;
  const x = Math.cos(dayAngle) * orbitRadius;
  const y = Math.sin(dayAngle) * 26;
  const z = -14 - Math.sin(dayAngle) * 4;

  // Irradiance peaks smoothly at noon, zero below horizon
  const irradiance = sinElev > 0 ? Math.pow(sinElev, 0.78) : 0;
  const isNight = hour < 5.5 || hour >= 18.8;
  const isDuskOrDawn = (hour >= 5.5 && hour < 7.6) || (hour >= 16.7 && hour < 18.8);

  let phaseLabel = 'Daylight';
  if (hour >= 5.3 && hour < 7.2) phaseLabel = 'Sunrise';
  else if (hour >= 7.2 && hour < 11.0) phaseLabel = 'Morning';
  else if (hour >= 11.0 && hour < 14.2) phaseLabel = 'Solar Noon';
  else if (hour >= 14.2 && hour < 16.8) phaseLabel = 'Afternoon';
  else if (hour >= 16.8 && hour < 18.8) phaseLabel = 'Golden Hour';
  else if (hour >= 18.8 && hour < 20.2) phaseLabel = 'Dusk';
  else phaseLabel = 'Night';

  // Interpolate sky, fog, and light colors across solar elevation
  let skyTopHex: string;
  let skyHorizonHex: string;
  let fogHex: string;
  let keyLightHex: string;
  let keyLightIntensity: number;
  let hemiSkyHex: string;
  let hemiGroundHex: string;
  let hemiIntensity: number;

  if (sinElev <= -0.15) {
    // Deep night
    skyTopHex = '#040814';
    skyHorizonHex = '#0c1930';
    fogHex = '#0a1426';
    keyLightHex = '#6488cc';
    keyLightIntensity = 0.25;
    hemiSkyHex = '#1e3a5f';
    hemiGroundHex = '#0a101d';
    hemiIntensity = 0.45;
  } else if (sinElev <= 0.22) {
    // Dawn / Dusk transition (-0.15 -> 0.22)
    const t = clamp((sinElev + 0.15) / 0.37, 0, 1);
    skyTopHex = lerpHexColor('#081226', '#1e4b85', t);
    skyHorizonHex = lerpHexColor('#162442', '#e88b5a', t);
    fogHex = lerpHexColor('#0f1b33', '#99645e', t);
    keyLightHex = lerpHexColor('#6c8ec9', '#ff9d5c', t);
    keyLightIntensity = lerp(0.3, 1.65, t);
    hemiSkyHex = lerpHexColor('#243b61', '#7b98c4', t);
    hemiGroundHex = lerpHexColor('#0b111e', '#2a2220', t);
    hemiIntensity = lerp(0.45, 0.72, t);
  } else {
    // Morning -> Noon -> Afternoon (0.22 -> 1.0)
    const t = clamp((sinElev - 0.22) / 0.78, 0, 1);
    skyTopHex = lerpHexColor('#1e4b85', '#1d69b8', t);
    skyHorizonHex = lerpHexColor('#e88b5a', '#87c5eb', t);
    fogHex = lerpHexColor('#99645e', '#4576a8', t);
    keyLightHex = lerpHexColor('#ffad6b', '#fff5e0', t);
    keyLightIntensity = lerp(1.65, 2.75, t);
    hemiSkyHex = lerpHexColor('#7b98c4', '#9bd2ff', t);
    hemiGroundHex = lerpHexColor('#2a2220', '#203042', t);
    hemiIntensity = lerp(0.72, 0.95, t);
  }

  return {
    hour,
    phaseLabel,
    elevationDeg: Number(elevationDeg.toFixed(1)),
    azimuthDeg: Number((((dayAngle / Math.PI) * 180)).toFixed(1)),
    sunPosition: [
      Number(x.toFixed(2)),
      Number(y.toFixed(2)),
      Number((z + Math.cos(elevationRad) * 2).toFixed(2)),
    ],
    irradiance: Number(irradiance.toFixed(3)),
    isNight,
    isDuskOrDawn,
    skyTopHex,
    skyHorizonHex,
    fogHex,
    keyLightHex,
    keyLightIntensity: Number(keyLightIntensity.toFixed(2)),
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity: Number(hemiIntensity.toFixed(2)),
  };
}

export function isLightingLit(mode: CitySimulationState['buildingLights'], sun: SunEnvironment): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return sun.isNight || sun.isDuskOrDawn;
}

export function computeCityMetrics(state: CitySimulationState): CityMetrics {
  const sun = computeSunState(state.timeHour);
  const buildingLightsLit = isLightingLit(state.buildingLights, sun);
  const streetlightsLit = isLightingLit(state.streetlights, sun);

  const trackingFactor = state.solarTracking ? 1.24 : 0.92;
  const solarActiveMult = state.solarArrayActive ? 1 : 0;

  // Ground microgrid peak ~ 18.5 MW, rooftop arrays ~ 11.2 MW
  const groundSolarMW = Number((18.5 * sun.irradiance * trackingFactor * solarActiveMult).toFixed(2));
  const rooftopSolarMW = Number((11.2 * sun.irradiance * (state.solarTracking ? 1.08 : 1.0)).toFixed(2));
  const solarGenerationMW = Number((groundSolarMW + rooftopSolarMW).toFixed(2));

  // Demand breakdown
  const baseCityLoad = 11.4;
  const lightingLoad = (buildingLightsLit ? 2.8 : 0.4) + (streetlightsLit ? 1.3 : 0.1);
  const airTowerLoad = ((state.airTowerAlphaRpm + state.airTowerBetaRpm) / 200) * 3.6;
  const metroLoad = state.metroActive ? 2.4 * state.metroSpeedMultiplier : 0.35;
  const parkLoad = state.parkIrrigation ? 0.9 : 0.2;

  const totalDemandMW = Number(
    (baseCityLoad + lightingLoad + airTowerLoad + metroLoad + parkLoad).toFixed(2),
  );
  const netGridBalanceMW = Number((solarGenerationMW - totalDemandMW).toFixed(2));

  // Simulated battery state of charge reacts smoothly to sun hour & surplus
  const daylightChargeBoost = sun.irradiance * 32;
  const surplusOffset = clamp(netGridBalanceMW * 1.4, -18, 22);
  const batteryChargePct = Number(
    clamp(58 + daylightChargeBoost + surplusOffset, 18, 99).toFixed(0),
  );

  // Air quality: lower AQI is cleaner. Towers + park + metro transit reduce particulates
  const avgTowerRpm = (state.airTowerAlphaRpm + state.airTowerBetaRpm) / 2;
  const towerCleaning = (avgTowerRpm / 100) * 34;
  const metroTransitShift = state.metroActive ? 8 : 0;
  const parkBonus = state.parkIrrigation ? 5 : 2;
  const pm25UgM3 = Number(
    clamp(28.5 - towerCleaning * 0.58 - metroTransitShift * 0.4 - parkBonus * 0.45, 4.2, 42.0).toFixed(1),
  );
  const airQualityIndex = Math.round(clamp(pm25UgM3 * 2.15, 11, 115));

  const co2CapturedTonsDay = Number(
    ((avgTowerRpm / 100) * 14.8 + (state.parkIrrigation ? 4.4 : 3.2)).toFixed(1),
  );

  const metroPassengersPerHour = state.metroActive
    ? Math.round(3200 * state.metroSpeedMultiplier)
    : 0;
  const metroHeadwaySec = state.metroActive
    ? Math.round(180 / state.metroSpeedMultiplier)
    : 0;

  const parkSoilMoisturePct = state.parkIrrigation
    ? 78
    : Math.round(clamp(54 - sun.irradiance * 14, 32, 68));

  return {
    solarGenerationMW,
    rooftopSolarMW,
    groundSolarMW,
    totalDemandMW,
    netGridBalanceMW,
    batteryChargePct,
    airQualityIndex,
    pm25UgM3,
    co2CapturedTonsDay,
    metroPassengersPerHour,
    metroHeadwaySec,
    parkSoilMoisturePct,
    buildingLightsLit,
    streetlightsLit,
  };
}

export function getComponentDetails(
  id: CityComponentId,
  state: CitySimulationState,
  metrics: CityMetrics,
): CityComponentDescriptor {
  const sun = computeSunState(state.timeHour);

  switch (id) {
    case 'eco-residences-west':
      return {
        id,
        name: 'Eco-Residences North-West',
        shortName: 'Eco-Residences',
        category: 'Smart Housing & Rooftop PV',
        level: 'Ground',
        functionSummary:
          'Net-positive cross-laminated timber housing cluster with integrated rooftop photovoltaic panels, thermal envelope glazing, and automated daylight-responsive LED interiors.',
        capabilities: [
          'Rooftop solar micro-generation with bidirectional grid export',
          'Automated dusk-to-dawn smart interior lighting control',
          'Geothermal heat-pump climate regulation',
        ],
        statusLabel: metrics.buildingLightsLit ? 'Night Illumination' : 'Daylight Eco',
        statusTone: metrics.buildingLightsLit ? 'active' : 'optimal',
        focusTarget: [-7.5, 2.2, -5.5],
        cameraOffset: [12, 10, 14],
        stats: [
          { label: 'Rooftop Output', value: (metrics.rooftopSolarMW * 0.52).toFixed(2), unit: 'MW' },
          { label: 'Interior Lights', value: metrics.buildingLightsLit ? 'Active' : 'Standby' },
          { label: 'Thermal Efficiency', value: '94.2', unit: '%' },
          { label: 'Occupant Units', value: '148', unit: 'apts' },
        ],
      };

    case 'civic-innovation-east':
      return {
        id,
        name: 'Civic Innovation Tower & Lofts',
        shortName: 'Innovation Tower',
        category: 'Mixed-Use Smart Complex',
        level: 'Ground',
        functionSummary:
          'High-density zero-carbon research and residential complex featuring BIPV solar terraces, automated window tinting, and direct underground metro elevator access.',
        capabilities: [
          'High-yield rooftop PV canopy and greywater recycling',
          'Dynamic occupancy lighting synced with city grid load',
          'Direct subterranean transfer link to Central Interchange',
        ],
        statusLabel: metrics.buildingLightsLit ? 'Illuminated' : 'Peak Solar',
        statusTone: metrics.buildingLightsLit ? 'active' : 'optimal',
        focusTarget: [8.0, 3.0, -5.5],
        cameraOffset: [13, 11, 15],
        stats: [
          { label: 'Rooftop Array', value: (metrics.rooftopSolarMW * 0.48).toFixed(2), unit: 'MW' },
          { label: 'Lighting Mode', value: state.buildingLights.toUpperCase() },
          { label: 'Grid Load', value: metrics.buildingLightsLit ? '3.4' : '1.9', unit: 'MW' },
          { label: 'Water Recycled', value: '18,400', unit: 'L/d' },
        ],
      };

    case 'solar-farm-ground':
      return {
        id,
        name: 'Helios Ground Solar Microgrid',
        shortName: 'Solar Microgrid',
        category: 'Utility-Scale PV & Storage',
        level: 'Ground',
        functionSummary:
          'Dual-axis sun-tracking photovoltaic field paired with containerized LiFePO4 grid storage banks that buffer renewable surplus for nocturnal city demand.',
        capabilities: [
          'Dual-axis azimuth and elevation sun tracking (+24% yield)',
          '24 MWh LiFePO4 battery dispatch and peak shaving',
          'Real-time inverter frequency stabilization',
        ],
        statusLabel: !state.solarArrayActive
          ? 'Offline'
          : sun.irradiance > 0.15
            ? 'Generating'
            : 'Battery Discharge',
        statusTone: !state.solarArrayActive ? 'standby' : state.solarTracking ? 'boosted' : 'optimal',
        focusTarget: [-8.2, 0.8, 4.8],
        cameraOffset: [11, 9, 13],
        stats: [
          { label: 'Array Output', value: metrics.groundSolarMW.toFixed(2), unit: 'MW' },
          { label: 'Sun Tracking', value: state.solarTracking ? 'Locked' : 'Fixed Tilt' },
          { label: 'Battery SoC', value: String(metrics.batteryChargePct), unit: '%' },
          { label: 'Solar Elevation', value: `${sun.elevationDeg}°` },
        ],
      };

    case 'air-purifier-alpha':
      return {
        id,
        name: 'AeroPure Tower Alpha',
        shortName: 'Air Tower Alpha',
        category: 'Atmospheric Scrubber',
        level: 'Ground',
        functionSummary:
          'Positive-pressure cyclonic air purification spire drawing ambient street-level air through electrostatic precipitators and carbon-capture mineralization filters.',
        capabilities: [
          'Variable-RPM axial intake turbine for PM2.5 capture',
          'Direct atmospheric CO2 mineralization loop',
          'Clean-air downwash plume shielding pedestrian zones',
        ],
        statusLabel:
          state.airTowerAlphaRpm === 0
            ? 'Idle'
            : state.airTowerAlphaRpm >= 85
              ? 'High Boost'
              : 'Scrubbing',
        statusTone:
          state.airTowerAlphaRpm === 0
            ? 'standby'
            : state.airTowerAlphaRpm >= 85
              ? 'boosted'
              : 'active',
        focusTarget: [-2.8, 3.2, -5.8],
        cameraOffset: [10, 9, 12],
        stats: [
          { label: 'Turbine RPM', value: String(state.airTowerAlphaRpm), unit: '%' },
          { label: 'District AQI', value: String(metrics.airQualityIndex), unit: 'AQI' },
          { label: 'PM2.5 Level', value: metrics.pm25UgM3.toFixed(1), unit: 'µg/m³' },
          { label: 'Airflow', value: Math.round(state.airTowerAlphaRpm * 420).toLocaleString(), unit: 'm³/h' },
        ],
      };

    case 'air-purifier-beta':
      return {
        id,
        name: 'AeroPure Tower Beta',
        shortName: 'Air Tower Beta',
        category: 'Atmospheric Scrubber',
        level: 'Ground',
        functionSummary:
          'Eastern corridor air filtration tower positioned near transit avenues to neutralize fine particulate matter and heat-island thermal plumes.',
        capabilities: [
          'HEPA + activated graphene particulate scrubbing',
          'Synchronized air-quality telemetry with Tower Alpha',
          'Acoustic-damped variable speed blower',
        ],
        statusLabel:
          state.airTowerBetaRpm === 0
            ? 'Idle'
            : state.airTowerBetaRpm >= 85
              ? 'High Boost'
              : 'Scrubbing',
        statusTone:
          state.airTowerBetaRpm === 0
            ? 'standby'
            : state.airTowerBetaRpm >= 85
              ? 'boosted'
              : 'active',
        focusTarget: [8.8, 3.0, 4.6],
        cameraOffset: [11, 9, 12],
        stats: [
          { label: 'Turbine RPM', value: String(state.airTowerBetaRpm), unit: '%' },
          { label: 'CO2 Captured', value: (metrics.co2CapturedTonsDay * 0.45).toFixed(1), unit: 't/day' },
          { label: 'PM2.5 Level', value: metrics.pm25UgM3.toFixed(1), unit: 'µg/m³' },
          { label: 'Power Draw', value: ((state.airTowerBetaRpm / 100) * 1.8).toFixed(2), unit: 'MW' },
        ],
      };

    case 'central-eco-park':
      return {
        id,
        name: 'Verdant Central Eco-Park',
        shortName: 'Central Eco-Park',
        category: 'Urban Biome & Stormwater Sink',
        level: 'Ground',
        functionSummary:
          'Multi-canopy urban woodland and retention bioswale pond engineered to cool microclimates, sequester carbon, and recharge groundwater via sensor-driven drip irrigation.',
        capabilities: [
          'Automated soil-moisture drip irrigation system',
          'Permeable bio-retention pond for zero stormwater runoff',
          'Canopy shade cooling reducing ambient block temp by 3.2°C',
        ],
        statusLabel: state.parkIrrigation ? 'Irrigating' : 'Balanced',
        statusTone: state.parkIrrigation ? 'boosted' : 'optimal',
        focusTarget: [0.5, 0.9, -0.2],
        cameraOffset: [11, 10, 12],
        stats: [
          { label: 'Soil Moisture', value: String(metrics.parkSoilMoisturePct), unit: '%' },
          { label: 'Tree Canopy', value: '28', unit: 'trees' },
          { label: 'Irrigation', value: state.parkIrrigation ? 'Active' : 'Standby' },
          { label: 'CO2 Sink', value: (state.parkIrrigation ? 4.4 : 3.2).toFixed(1), unit: 't/day' },
        ],
      };

    case 'smart-road-grid':
      return {
        id,
        name: 'Autonomous Smart Transit Avenue',
        shortName: 'Smart Roadway',
        category: 'EV Inductive Grid & Streetlighting',
        level: 'Ground',
        functionSummary:
          'Dynamic-charging electric transit avenue equipped with embedded inductive copper coils, permeable low-noise asphalt, and adaptive LED streetlight luminaires.',
        capabilities: [
          'Dynamic wireless inductive EV shuttle charging lanes',
          'Twilight-sensing adaptive LED streetlighting network',
          'Zero-emission autonomous micro-transit corridor',
        ],
        statusLabel: metrics.streetlightsLit ? 'Night Grid Active' : 'Daylight Transit',
        statusTone: metrics.streetlightsLit ? 'active' : 'optimal',
        focusTarget: [0, 0.4, 2.5],
        cameraOffset: [14, 11, 14],
        stats: [
          { label: 'Streetlights', value: metrics.streetlightsLit ? 'Illuminated' : 'Off' },
          { label: 'Lighting Mode', value: state.streetlights.toUpperCase() },
          { label: 'EV Shuttles', value: '3', unit: 'active' },
          { label: 'Coil Efficiency', value: '91.5', unit: '%' },
        ],
      };

    case 'metro-station-west':
      return {
        id,
        name: 'Westgate Subterranean Hub',
        shortName: 'Westgate Station',
        category: 'Underground Metro Terminal',
        level: 'Underground',
        functionSummary:
          'Cutaway below-grade transit station beneath the residential and solar districts, featuring automated platform screen doors, regenerative braking capture, and LED concourse lighting.',
        capabilities: [
          'Regenerative braking energy recovery fed into station grid',
          'Automated platform air-curtain climate isolation',
          'Barrier-free vertical lift shaft to surface plaza',
        ],
        statusLabel: state.metroActive ? 'Boarding Active' : 'Platform Standby',
        statusTone: state.metroActive ? 'active' : 'standby',
        focusTarget: [-6.8, -2.5, 5.2],
        cameraOffset: [10, 7, 13],
        stats: [
          { label: 'Station Depth', value: '-14.5', unit: 'm' },
          { label: 'Concourse Lights', value: state.metroStationLights ? 'On' : 'Dimmed' },
          { label: 'Headway', value: state.metroActive ? `${metrics.metroHeadwaySec}s` : 'Paused' },
          { label: 'Platform Temp', value: '20.4', unit: '°C' },
        ],
      };

    case 'metro-station-east':
      return {
        id,
        name: 'Central Interchange Station',
        shortName: 'Central Station',
        category: 'Underground Metro Terminal',
        level: 'Underground',
        functionSummary:
          'Main subterranean commuter concourse linking Civic Innovation Tower with the express metro spine, engineered with structural concrete arches and acoustic damping.',
        capabilities: [
          'High-capacity commuter transfer concourse',
          'Subterranean HEPA tunnel ventilation loop',
          'Smart signal interlocking with automated train dispatch',
        ],
        statusLabel: state.metroActive ? 'Dispatch Active' : 'Hold',
        statusTone: state.metroActive ? 'active' : 'standby',
        focusTarget: [6.8, -2.5, 5.2],
        cameraOffset: [10, 7, 13],
        stats: [
          { label: 'Station Depth', value: '-14.5', unit: 'm' },
          { label: 'Throughput', value: metrics.metroPassengersPerHour.toLocaleString(), unit: 'pax/h' },
          { label: 'Concourse Lights', value: state.metroStationLights ? 'On' : 'Dimmed' },
          { label: 'Signal Lock', value: state.metroActive ? 'Green' : 'Red' },
        ],
      };

    case 'metro-tunnel-line':
      return {
        id,
        name: 'Mag-Rail Express Tunnel & Rolling Stock',
        shortName: 'Metro Tunnel Line',
        category: 'Subterranean Electric Rail',
        level: 'Underground',
        functionSummary:
          'Twin-track cutaway subterranean rail corridor powered by clean solar-backed DC traction, operating zero-emission 3-car electric trainsets between Westgate and Central Interchange.',
        capabilities: [
          'Automated regenerative DC traction rail corridor',
          'Real-time dispatch frequency scaling (0.5x to 2.0x)',
          'Cutaway geological rock-strata structural monitoring',
        ],
        statusLabel: state.metroActive
          ? `${state.metroSpeedMultiplier.toFixed(1)}x Speed`
          : 'Suspended',
        statusTone: !state.metroActive
          ? 'standby'
          : state.metroSpeedMultiplier > 1.2
            ? 'boosted'
            : 'active',
        focusTarget: [0, -2.6, 5.2],
        cameraOffset: [12, 6, 15],
        stats: [
          { label: 'Active Trains', value: state.metroActive ? '2' : '0', unit: 'sets' },
          { label: 'Line Speed', value: state.metroActive ? `${Math.round(68 * state.metroSpeedMultiplier)}` : '0', unit: 'km/h' },
          { label: 'Capacity', value: metrics.metroPassengersPerHour.toLocaleString(), unit: 'pax/h' },
          { label: 'Traction Load', value: (state.metroActive ? 2.4 * state.metroSpeedMultiplier : 0.35).toFixed(2), unit: 'MW' },
        ],
      };
  }
}

export function applyCityAction(
  prev: CitySimulationState,
  action: CityAction,
): CitySimulationState {
  switch (action.type) {
    case 'SET_TIME':
      return { ...prev, timeHour: ((action.hour % 24) + 24) % 24 };
    case 'SET_TIME_PLAYING':
      return { ...prev, isPlayingTime: action.playing };
    case 'SET_BUILDING_LIGHTS':
      return { ...prev, buildingLights: action.mode };
    case 'SET_STREETLIGHTS':
      return { ...prev, streetlights: action.mode };
    case 'SET_SOLAR_TRACKING':
      return { ...prev, solarTracking: action.enabled };
    case 'SET_SOLAR_ACTIVE':
      return { ...prev, solarArrayActive: action.enabled };
    case 'SET_AIR_TOWERS_RPM': {
      const rpm = clamp(Math.round(action.rpm), 0, 100);
      return { ...prev, airTowerAlphaRpm: rpm, airTowerBetaRpm: rpm };
    }
    case 'SET_PARK_IRRIGATION':
      return { ...prev, parkIrrigation: action.enabled };
    case 'SET_METRO_ACTIVE':
      return { ...prev, metroActive: action.active };
    case 'SET_METRO_SPEED':
      return { ...prev, metroSpeedMultiplier: clamp(action.multiplier, 0.5, 2.0) };
    case 'SET_METRO_STATION_LIGHTS':
      return { ...prev, metroStationLights: action.enabled };
    case 'SET_CUTAWAY_MODE':
      return { ...prev, cutawayMode: action.mode };
    case 'SELECT_COMPONENT':
    case 'SET_CAMERA_PRESET':
      return prev;
  }
}
