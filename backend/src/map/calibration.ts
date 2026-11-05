// Map calibration: transform between image-pixel coordinates and metric
// floor coordinates. A calibrated map defines:
//   - scale: pixels per metre (ppm)
//   - origin: metric (x,y) of image pixel (0,0)
//   - rotation: degrees (counter-clockwise) of the metric frame vs the image
//
// This lets an editor drop a floor-plan image and place nodes in metric space,
// and lets the patient app render the same metric space on an SVG canvas.

export interface Calibration {
  scalePpm: number;       // pixels per metre
  originX: number;        // metric x of image (0,0)
  originY: number;        // metric y of image (0,0)
  rotationDeg: number;    // rotation of metric frame (degrees, CCW)
  imageWidthPx: number;
  imageHeightPx: number;
}

export interface MetricPoint {
  x: number;
  y: number;
}

export interface PixelPoint {
  px: number;
  py: number;
}

const DEG2RAD = Math.PI / 180;

/** pixel (image coords) -> metric floor coords */
export function pixelToMetric(p: PixelPoint, cal: Calibration): MetricPoint {
  const r = cal.rotationDeg * DEG2RAD;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const metresPerPixel = 1 / cal.scalePpm;
  // translate pixel into metres relative to origin, then rotate.
  const dx = (p.px) * metresPerPixel;
  const dy = (p.py) * metresPerPixel;
  // image y is downward; metric y is upward -> flip y, then rotate.
  const mx = dx * cos - (-dy) * sin;
  const my = dx * sin + (-dy) * cos;
  return { x: cal.originX + mx, y: cal.originY + my };
}

/** metric floor coords -> pixel (image coords) */
export function metricToPixel(m: MetricPoint, cal: Calibration): PixelPoint {
  const r = cal.rotationDeg * DEG2RAD;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const metresPerPixel = 1 / cal.scalePpm;
  const dx = m.x - cal.originX;
  const dy = m.y - cal.originY;
  // inverse rotation
  const pxr = dx * cos + dy * sin;
  const pyr = -dx * sin + dy * cos;
  return { px: pxr / metresPerPixel, py: -pyr / metresPerPixel };
}

/** Distance between two metric points (metres). */
export function metricDistance(a: MetricPoint, b: MetricPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Validate a calibration is internally consistent. */
export function validateCalibration(cal: Calibration): { ok: boolean; error?: string } {
  if (!cal || typeof cal.scalePpm !== 'number' || cal.scalePpm <= 0) {
    return { ok: false, error: 'scalePpm must be a positive number' };
  }
  if (!Number.isFinite(cal.originX) || !Number.isFinite(cal.originY)) {
    return { ok: false, error: 'origin must be finite numbers' };
  }
  if (cal.imageWidthPx <= 0 || cal.imageHeightPx <= 0) {
    return { ok: false, error: 'image dimensions must be positive' };
  }
  return { ok: true };
}
