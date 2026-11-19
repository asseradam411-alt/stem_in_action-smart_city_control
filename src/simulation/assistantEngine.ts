import {
  CityAction,
  CityComponentId,
  CityMetrics,
  CitySimulationState,
} from '../types/city';
import {
  computeCityMetrics,
  computeSunState,
  formatClockHour,
  getComponentDetails,
} from './citySimulation';

export interface AssistantResponsePayload {
  reply: string;
  actions: CityAction[];
  appliedLabels: string[];
  suggestedPrompts: string[];
}

export function describeAction(action: CityAction): string {
  switch (action.type) {
    case 'SET_TIME':
      return `Time set to ${formatClockHour(action.hour)}`;
    case 'SET_TIME_PLAYING':
      return action.playing ? 'Sun cycle playing' : 'Sun cycle paused';
    case 'SET_BUILDING_LIGHTS':
      return `Building lights: ${action.mode}`;
    case 'SET_STREETLIGHTS':
      return `Streetlights: ${action.mode}`;
    case 'SET_SOLAR_TRACKING':
      return `Solar tracking ${action.enabled ? 'enabled' : 'disabled'}`;
    case 'SET_SOLAR_ACTIVE':
      return `Ground solar array ${action.enabled ? 'online' : 'standby'}`;
    case 'SET_AIR_TOWERS_RPM':
      return `Air purifiers at ${action.rpm}% RPM`;
    case 'SET_PARK_IRRIGATION':
      return `Park irrigation ${action.enabled ? 'active' : 'standby'}`;
    case 'SET_METRO_ACTIVE':
      return `Metro line ${action.active ? 'running' : 'paused'}`;
    case 'SET_METRO_SPEED':
      return `Metro speed ${action.multiplier.toFixed(1)}x`;
    case 'SET_METRO_STATION_LIGHTS':
      return `Station lights ${action.enabled ? 'on' : 'dimmed'}`;
    case 'SET_CUTAWAY_MODE':
      return `Layer view: ${action.mode}`;
    case 'SELECT_COMPONENT':
      return `Focused: ${action.id}`;
    case 'SET_CAMERA_PRESET':
      return `Camera: ${action.preset}`;
  }
}

export function processAssistantCommand(
  input: string,
  state: CitySimulationState,
  selectedComponentId: CityComponentId | null,
): AssistantResponsePayload {
  const q = input.trim().toLowerCase();
  const metrics: CityMetrics = computeCityMetrics(state);
  const sun = computeSunState(state.timeHour);
  const actions: CityAction[] = [];
  const notes: string[] = [];

  // 1. Lights control (building lights / streetlights / metro lights)
  if (/\b(light|lights|lamp|lamps|illumination|streetlights?)\b/.test(q)) {
    const wantsOff = /\b(off|disable|dim|shut|stop)\b/.test(q);
    const wantsAuto = /\b(auto|automatic|sensor|twilight)\b/.test(q);
    const wantsOn = /\b(on|enable|turn on|activate|bright|light up)\b/.test(q);

    const targetsBuilding = /\b(building|buildings|house|houses|home|tower|towers|residence|residences|window|windows|interior)\b/.test(q);
    const targetsStreet = /\b(street|streets|streetlights?|road|roads|avenue|corridor)\b/.test(q);
    const targetsMetro = /\b(metro|station|stations|tunnel|underground)\b/.test(q);
    const targetsAll = !targetsBuilding && !targetsStreet && !targetsMetro;

    const mode = wantsAuto ? 'auto' : wantsOff ? 'off' : wantsOn ? 'on' : 'on';

    if (targetsBuilding || targetsAll) {
      actions.push({ type: 'SET_BUILDING_LIGHTS', mode });
    }
    if (targetsStreet || targetsAll) {
      actions.push({ type: 'SET_STREETLIGHTS', mode });
    }
    if (targetsMetro || targetsAll) {
      actions.push({ type: 'SET_METRO_STATION_LIGHTS', enabled: mode !== 'off' });
    }

    const modeDesc =
      mode === 'auto'
        ? 'automatic twilight-sensor mode'
        : mode === 'on'
          ? 'full manual illumination'
          : 'energy-saving standby (off)';

    notes.push(
      `Configured ${targetsAll ? 'city-wide building, street, and metro' : 'targeted'} lighting to ${modeDesc}.`,
    );
  }

  // 2. Time / Sun simulation
  if (/\b(night|midnight)\b/.test(q) && !/\blight/.test(q)) {
    actions.push({ type: 'SET_TIME', hour: 22.0 });
    actions.push({ type: 'SET_TIME_PLAYING', playing: false });
    notes.push('Advanced solar clock to 22:00 (Night) so nocturnal illumination and battery dispatch are active.');
  } else if (/\b(sunset|dusk|golden hour|evening)\b/.test(q)) {
    actions.push({ type: 'SET_TIME', hour: 17.8 });
    actions.push({ type: 'SET_TIME_PLAYING', playing: false });
    notes.push('Positioned sun at 17:48 (Golden Hour / Dusk transition).');
  } else if (/\b(sunrise|dawn|morning)\b/.test(q)) {
    actions.push({ type: 'SET_TIME', hour: 6.5 });
    actions.push({ type: 'SET_TIME_PLAYING', playing: false });
    notes.push('Positioned sun at 06:30 (Sunrise).');
  } else if (/\b(noon|midday|daytime|peak sun)\b/.test(q)) {
    actions.push({ type: 'SET_TIME', hour: 12.2 });
    actions.push({ type: 'SET_TIME_PLAYING', playing: false });
    notes.push('Positioned sun at 12:12 (Solar Noon) for maximum photovoltaic irradiance.');
  } else if (/\b(play|start|animate)\b/.test(q) && /\b(sun|time|cycle|day)\b/.test(q)) {
    actions.push({ type: 'SET_TIME_PLAYING', playing: true });
    notes.push('Started continuous sunrise-to-night solar cycle animation.');
  } else if (/\b(pause|stop)\b/.test(q) && /\b(sun|time|cycle|day)\b/.test(q)) {
    actions.push({ type: 'SET_TIME_PLAYING', playing: false });
    notes.push('Paused solar cycle animation.');
  }

  // 3. Solar energy & battery checks/controls
  if (/\b(solar|pv|panel|panels|energy|grid|battery|power|megawatt|mw)\b/.test(q)) {
    if (/\b(track|tracking|enable|optimize|boost|on)\b/.test(q)) {
      actions.push({ type: 'SET_SOLAR_TRACKING', enabled: true });
      actions.push({ type: 'SET_SOLAR_ACTIVE', enabled: true });
      actions.push({ type: 'SELECT_COMPONENT', id: 'solar-farm-ground' });
      notes.push(
        `Enabled dual-axis solar tracking (+24% yield). Current total solar generation is ${metrics.solarGenerationMW} MW (${metrics.groundSolarMW} MW ground + ${metrics.rooftopSolarMW} MW rooftop) against ${metrics.totalDemandMW} MW demand; LiFePO4 battery is at ${metrics.batteryChargePct}%.`,
      );
    } else if (/\b(disable|off|standby)\b/.test(q)) {
      actions.push({ type: 'SET_SOLAR_ACTIVE', enabled: false });
      notes.push('Placed Helios Ground Solar Microgrid into maintenance standby; city is drawing from rooftop PV and battery storage.');
    } else {
      const surplus =
        metrics.netGridBalanceMW >= 0
          ? `+${metrics.netGridBalanceMW} MW surplus charging battery`
          : `${metrics.netGridBalanceMW} MW net draw from battery storage`;
      notes.push(
        `Solar Telemetry (${sun.phaseLabel}, ${sun.elevationDeg}° sun angle): Generating ${metrics.solarGenerationMW} MW total (${metrics.groundSolarMW} MW ground microgrid, ${metrics.rooftopSolarMW} MW rooftop arrays). Total city demand is ${metrics.totalDemandMW} MW (${surplus}). Battery SoC: ${metrics.batteryChargePct}%.`,
      );
    }
  }

  // 4. Metro routes, underground cutaway & train dispatch
  if (/\b(metro|train|trains|tunnel|rail|route|routes|station|underground|subway)\b/.test(q)) {
    if (/\b(pause|stop|halt|suspend)\b/.test(q)) {
      actions.push({ type: 'SET_METRO_ACTIVE', active: false });
      actions.push({ type: 'SELECT_COMPONENT', id: 'metro-tunnel-line' });
      notes.push('Halted underground metro rolling stock at Westgate and Central Interchange stations.');
    } else if (/\b(boost|fast|express|speed up|accelerate|increase)\b/.test(q)) {
      actions.push({ type: 'SET_METRO_ACTIVE', active: true });
      actions.push({ type: 'SET_METRO_SPEED', multiplier: 1.75 });
      actions.push({ type: 'SET_CUTAWAY_MODE', mode: 'cutaway' });
      actions.push({ type: 'SELECT_COMPONENT', id: 'metro-tunnel-line' });
      actions.push({ type: 'SET_CAMERA_PRESET', preset: 'underground' });
      notes.push(
        'Switched Mag-Rail Express to 1.75x express dispatch (~103s headway, ~5,600 pax/h) and focused camera on the underground cutaway corridor.',
      );
    } else if (/\b(resume|start|run)\b/.test(q)) {
      actions.push({ type: 'SET_METRO_ACTIVE', active: true });
      actions.push({ type: 'SET_METRO_SPEED', multiplier: 1.0 });
      notes.push('Resumed standard 1.0x underground metro operations across both stations.');
    } else {
      if (/\b(view|show|focus|inspect|cutaway)\b/.test(q)) {
        actions.push({ type: 'SET_CUTAWAY_MODE', mode: 'cutaway' });
        actions.push({ type: 'SET_CAMERA_PRESET', preset: 'underground' });
      }
      actions.push({ type: 'SELECT_COMPONENT', id: 'metro-tunnel-line' });
      notes.push(
        `Metro Route Analysis: 2 electric 3-car trainsets ${metrics.metroPassengersPerHour > 0 ? `running at ${state.metroSpeedMultiplier.toFixed(1)}x (${metrics.metroHeadwaySec}s headway, ${metrics.metroPassengersPerHour.toLocaleString()} pax/h)` : 'currently paused'} between Westgate Hub (-14.5m) and Central Interchange (-14.5m). Traction draw: ${(state.metroActive ? 2.4 * state.metroSpeedMultiplier : 0.35).toFixed(2)} MW.`,
      );
    }
  }

  // 5. Air quality & purification towers
  if (/\b(air|aqi|pm2\.5|pm25|purifier|purifiers|smog|scrubber|co2|quality|tower|towers)\b/.test(q)) {
    if (/\b(boost|max|maximum|100|high|increase|scrub)\b/.test(q)) {
      actions.push({ type: 'SET_AIR_TOWERS_RPM', rpm: 95 });
      actions.push({ type: 'SELECT_COMPONENT', id: 'air-purifier-alpha' });
      notes.push(
        'Boosted AeroPure Towers Alpha and Beta to 95% turbine RPM. Particulate capture rate increased to ~80,000 m³/h combined.',
      );
    } else if (/\b(eco|low|quiet|reduce|save)\b/.test(q)) {
      actions.push({ type: 'SET_AIR_TOWERS_RPM', rpm: 45 });
      notes.push('Set AeroPure Towers Alpha and Beta to 45% quiet eco-scrubbing mode.');
    } else {
      notes.push(
        `Air Quality Report: District AQI is ${metrics.airQualityIndex} (${metrics.airQualityIndex <= 35 ? 'Excellent' : metrics.airQualityIndex <= 55 ? 'Good' : 'Moderate'}), PM2.5 at ${metrics.pm25UgM3} µg/m³. AeroPure Alpha (${state.airTowerAlphaRpm}% RPM) and Beta (${state.airTowerBetaRpm}% RPM) plus park canopy are capturing ${metrics.co2CapturedTonsDay} tons CO2/day.`,
      );
    }
  }

  // 6. Parks, trees & irrigation
  if (/\b(park|parks|tree|trees|garden|green|irrigat|water|moisture|bioswale)\b/.test(q)) {
    if (/\b(stop|off|disable|pause)\b/.test(q)) {
      actions.push({ type: 'SET_PARK_IRRIGATION', enabled: false });
      actions.push({ type: 'SELECT_COMPONENT', id: 'central-eco-park' });
      notes.push('Placed Verdant Central Eco-Park drip irrigation into standby.');
    } else if (/\b(start|on|enable|activate|irrigate|water|mist)\b/.test(q)) {
      actions.push({ type: 'SET_PARK_IRRIGATION', enabled: true });
      actions.push({ type: 'SELECT_COMPONENT', id: 'central-eco-park' });
      notes.push(
        'Activated smart drip irrigation and bioswale recirculation in Verdant Central Eco-Park. Target soil moisture raised to 78% with enhanced evaporative cooling.',
      );
    } else {
      actions.push({ type: 'SELECT_COMPONENT', id: 'central-eco-park' });
      notes.push(
        `Eco-Park Telemetry: 28 multi-canopy trees and bio-retention pond operating nominally. Soil moisture is ${metrics.parkSoilMoisturePct}%, irrigation is ${state.parkIrrigation ? 'active' : 'standby'}, and canopy carbon sequestration is ${(state.parkIrrigation ? 4.4 : 3.2).toFixed(1)} t/day.`,
      );
    }
  }

  // 7. Cutaway / camera reset
  if (/\b(reset camera|overview|isometric)\b/.test(q)) {
    actions.push({ type: 'SET_CAMERA_PRESET', preset: 'isometric' });
    actions.push({ type: 'SET_CUTAWAY_MODE', mode: 'cutaway' });
    notes.push('Reset camera to isometric engineering cutaway view.');
  } else if (/\b(surface only|ground only|hide underground)\b/.test(q)) {
    actions.push({ type: 'SET_CUTAWAY_MODE', mode: 'surface' });
    notes.push('Switched layer view to surface-only infrastructure.');
  } else if (/\b(underground only|subterranean)\b/.test(q) && !/\bmetro\b/.test(q)) {
    actions.push({ type: 'SET_CUTAWAY_MODE', mode: 'underground' });
    actions.push({ type: 'SET_CAMERA_PRESET', preset: 'underground' });
    notes.push('Isolated underground metro and structural tunnel cutaway layer.');
  }

  // 8. Selected component inspection fallback
  if (notes.length === 0) {
    if (selectedComponentId) {
      const desc = getComponentDetails(selectedComponentId, state, metrics);
      const topStats = desc.stats.map((s) => `${s.label}: ${s.value}${s.unit ? ` ${s.unit}` : ''}`).join(' | ');
      notes.push(
        `Inspecting ${desc.name} (${desc.level} · ${desc.statusLabel}). ${desc.functionSummary} Live metrics — ${topStats}.`,
      );
    } else {
      notes.push(
        `VerdantGrid Status at ${formatClockHour(state.timeHour)} (${sun.phaseLabel}): Solar generation ${metrics.solarGenerationMW} MW vs ${metrics.totalDemandMW} MW load, AQI ${metrics.airQualityIndex}, Metro ${state.metroActive ? 'running' : 'paused'}. Try commands like "turn on building lights", "check solar energy", "analyze metro routes", "boost air purifiers", or "irrigate parks".`,
      );
    }
  }

  return {
    reply: notes.join(' '),
    actions,
    appliedLabels: actions.map(describeAction),
    suggestedPrompts: [
      'Check solar energy',
      'Turn on building lights',
      'Analyze metro routes',
      'Boost air purifiers',
      'Irrigate parks',
    ],
  };
}
