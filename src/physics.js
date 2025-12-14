const G = 9.81;

function clampInnerRadius(outerRadius, thickness) {
  return Math.max(0, outerRadius - thickness);
}

export function computeInertia(shape, { mass, radius, thickness = 0 }) {
  const rInner = clampInnerRadius(radius, thickness);

  switch (shape) {
    case 'solidSphere':
      return (2 / 5) * mass * radius * radius;
    case 'hollowSphere': {
      const rOut5 = Math.pow(radius, 5);
      const rIn5 = Math.pow(rInner, 5);
      const rOut3 = Math.pow(radius, 3);
      const rIn3 = Math.pow(rInner, 3);
      const inertiaFactor = (rOut5 - rIn5) / (rOut3 - rIn3 || 1);
      return (2 / 5) * mass * inertiaFactor;
    }
    case 'solidCylinder':
      return 0.5 * mass * radius * radius;
    case 'hollowCylinder': {
      const rOut4 = Math.pow(radius, 4);
      const rIn4 = Math.pow(rInner, 4);
      const inertiaFactor = (rOut4 - rIn4) / (Math.pow(radius, 2) - Math.pow(rInner, 2) || 1);
      return 0.5 * mass * inertiaFactor;
    }
    default:
      return 0;
  }
}

export function computeAcceleration({ thetaRad, inertia, mass, radius }) {
  return (G * Math.sin(thetaRad)) / (1 + inertia / (mass * radius * radius));
}

export function computeTime({ length, acceleration }) {
  return Math.sqrt((2 * length) / acceleration);
}
