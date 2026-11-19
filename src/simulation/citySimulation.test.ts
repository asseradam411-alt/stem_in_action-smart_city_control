import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIMULATION_STATE,
  applyCityAction,
  computeCityMetrics,
  computeSunState,
  formatClockHour,
  getComponentDetails,
} from './citySimulation';

test('computeSunState calculates sunrise, noon, sunset, and night irradiance accurately', () => {
  const noon = computeSunState(12.0);
  const midnight = computeSunState(0.0);
  const sunrise = computeSunState(6.0);

  assert.equal(noon.phaseLabel, 'Solar Noon');
  assert.ok(noon.irradiance > 0.95, 'Noon irradiance should be near 1');
  assert.ok(noon.sunPosition[1] > 20, 'Noon sun should be high in sky (+Y)');
  assert.equal(noon.isNight, false);

  assert.equal(midnight.phaseLabel, 'Night');
  assert.equal(midnight.irradiance, 0);
  assert.equal(midnight.isNight, true);
  assert.ok(midnight.sunPosition[1] < 0, 'Midnight sun should be below horizon');

  assert.equal(sunrise.phaseLabel, 'Sunrise');
  assert.equal(sunrise.isDuskOrDawn, true);
});

test('computeCityMetrics reacts to solar tracking, time of day, and air purifier RPM', () => {
  const noonTracked = computeCityMetrics({
    ...DEFAULT_SIMULATION_STATE,
    timeHour: 12,
    solarTracking: true,
  });
  const noonFixed = computeCityMetrics({
    ...DEFAULT_SIMULATION_STATE,
    timeHour: 12,
    solarTracking: false,
  });
  const night = computeCityMetrics({
    ...DEFAULT_SIMULATION_STATE,
    timeHour: 23,
  });

  assert.ok(noonTracked.solarGenerationMW > noonFixed.solarGenerationMW);
  assert.equal(night.solarGenerationMW, 0);
  assert.equal(night.buildingLightsLit, true);
  assert.equal(night.streetlightsLit, true);

  const highAir = computeCityMetrics({
    ...DEFAULT_SIMULATION_STATE,
    airTowerAlphaRpm: 100,
    airTowerBetaRpm: 100,
  });
  const offAir = computeCityMetrics({
    ...DEFAULT_SIMULATION_STATE,
    airTowerAlphaRpm: 0,
    airTowerBetaRpm: 0,
  });
  assert.ok(highAir.airQualityIndex < offAir.airQualityIndex, 'Higher RPM should lower AQI');
});

test('applyCityAction updates state immutably and getComponentDetails returns telemetry', () => {
  let state = DEFAULT_SIMULATION_STATE;
  state = applyCityAction(state, { type: 'SET_METRO_SPEED', multiplier: 1.8 });
  state = applyCityAction(state, { type: 'SET_PARK_IRRIGATION', enabled: true });

  assert.equal(state.metroSpeedMultiplier, 1.8);
  assert.equal(state.parkIrrigation, true);

  const metrics = computeCityMetrics(state);
  const metroDetails = getComponentDetails('metro-tunnel-line', state, metrics);
  assert.equal(metroDetails.level, 'Underground');
  assert.ok(metroDetails.capabilities.length >= 2);
  assert.equal(formatClockHour(13.5), '13:30');
});
