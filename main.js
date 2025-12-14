import { computeAcceleration, computeInertia, computeTime } from './src/physics.js';
import { CAMERA_MODES, SimulationView } from './src/view.js';

const angleInput = document.getElementById('angle');
const distanceInput = document.getElementById('distance');
const diameterInput = document.getElementById('diameter');
const thicknessInput = document.getElementById('thickness');
const massInput = document.getElementById('mass');
const shapeSelect = document.getElementById('shape');
const startButton = document.getElementById('start');
const viewToggle = document.getElementById('viewToggle');
const timeResult = document.getElementById('timeResult');

const angleValue = document.getElementById('angleValue');
const distanceValue = document.getElementById('distanceValue');
const diameterValue = document.getElementById('diameterValue');
const thicknessValue = document.getElementById('thicknessValue');

const simView = new SimulationView('scene');
let currentCamera = CAMERA_MODES.ANGLED;

function updateLabel(input, labelEl, unit = '') {
  labelEl.textContent = parseFloat(input.value).toString();
  if (unit) labelEl.textContent += unit;
}

function updateThicknessState() {
  const isHollow = shapeSelect.value.includes('hollow');
  thicknessInput.disabled = !isHollow;
  thicknessInput.parentElement.classList.toggle('muted', !isHollow);
}

function getParams() {
  const thetaDeg = parseFloat(angleInput.value);
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const length = parseFloat(distanceInput.value);
  const diameter = parseFloat(diameterInput.value);
  const radius = diameter / 2;
  const thickness = parseFloat(thicknessInput.value);
  const mass = parseFloat(massInput.value);
  const shape = shapeSelect.value;

  const inertia = computeInertia(shape, { mass, radius, thickness });
  const acceleration = computeAcceleration({ thetaRad, inertia, mass, radius });
  const time = computeTime({ length, acceleration });

  return { thetaDeg, thetaRad, length, diameter, radius, thickness, mass, shape, inertia, acceleration, time };
}

function updateDisplayValues() {
  updateLabel(angleInput, angleValue);
  updateLabel(distanceInput, distanceValue);
  updateLabel(diameterInput, diameterValue);
  updateLabel(thicknessInput, thicknessValue);
}

function startSimulation() {
  const params = getParams();
  timeResult.textContent = params.time.toFixed(2);
  simView.startRun({
    shape: params.shape,
    radius: params.radius,
    thetaRad: params.thetaRad,
    length: params.length,
    acceleration: params.acceleration,
  });
}

function toggleCamera() {
  currentCamera = currentCamera === CAMERA_MODES.ANGLED ? CAMERA_MODES.SIDE : CAMERA_MODES.ANGLED;
  const params = getParams();
  simView.setCamera(currentCamera);
}

angleInput.addEventListener('input', () => {
  updateDisplayValues();
  startSimulation();
});

[distanceInput, diameterInput, thicknessInput].forEach((input) =>
  input.addEventListener('input', () => updateDisplayValues())
);
shapeSelect.addEventListener('change', () => {
  updateThicknessState();
  updateDisplayValues();
});
massInput.addEventListener('input', () => {});
startButton.addEventListener('click', startSimulation);
viewToggle.addEventListener('click', toggleCamera);

updateDisplayValues();
updateThicknessState();
startSimulation();
