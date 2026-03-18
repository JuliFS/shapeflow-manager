/**
 * Parse a binary or ASCII STL file and return the volume in cm³.
 * Uses the signed-volume-of-triangle method for binary STL.
 */
export function parseSTLVolume(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);

  // Check if binary: header (80 bytes) + num triangles (4 bytes) + triangles
  // ASCII starts with "solid"
  const header = new Uint8Array(buffer, 0, 5);
  const isAscii = String.fromCharCode(...header) === "solid";

  if (!isAscii && buffer.byteLength > 84) {
    return parseBinarySTL(view);
  }

  // For ASCII STL, try binary anyway (some files say "solid" but are binary)
  if (buffer.byteLength > 84) {
    const numTriangles = view.getUint32(80, true);
    const expectedSize = 84 + numTriangles * 50;
    if (Math.abs(expectedSize - buffer.byteLength) < 100) {
      return parseBinarySTL(view);
    }
  }

  throw new Error("Formato STL não suportado. Use arquivos STL binários.");
}

function parseBinarySTL(view: DataView): number {
  const numTriangles = view.getUint32(80, true);
  let totalVolume = 0;

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    // Skip normal (12 bytes), read 3 vertices (each 12 bytes = 3 floats)
    const v1x = view.getFloat32(offset + 12, true);
    const v1y = view.getFloat32(offset + 16, true);
    const v1z = view.getFloat32(offset + 20, true);
    const v2x = view.getFloat32(offset + 24, true);
    const v2y = view.getFloat32(offset + 28, true);
    const v2z = view.getFloat32(offset + 32, true);
    const v3x = view.getFloat32(offset + 36, true);
    const v3y = view.getFloat32(offset + 40, true);
    const v3z = view.getFloat32(offset + 44, true);

    // Signed volume of tetrahedron formed with origin
    totalVolume += signedVolumeOfTriangle(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z);
  }

  // Volume in mm³ → cm³ (divide by 1000)
  return Math.abs(totalVolume) / 1000;
}

function signedVolumeOfTriangle(
  v1x: number, v1y: number, v1z: number,
  v2x: number, v2y: number, v2z: number,
  v3x: number, v3y: number, v3z: number
): number {
  return (
    (v1x * (v2y * v3z - v3y * v2z) -
     v2x * (v1y * v3z - v3y * v1z) +
     v3x * (v1y * v2z - v2y * v1z)) / 6.0
  );
}

export interface STLAnalysis {
  volumeCm3: number;
  weightGrams: number;
  estimatedPrintTimeHours: number;
}

/**
 * Analyze STL file given material density and average print speed.
 * @param volumeCm3 - Volume in cm³
 * @param densityGPerCm3 - Material density in g/cm³ (PLA ~1.24)
 * @param printSpeedCm3PerHour - Print speed in cm³/hour (typical ~15-20 for FDM)
 */
export function analyzeSTL(
  volumeCm3: number,
  densityGPerCm3: number = 1.24,
  printSpeedCm3PerHour: number = 15
): STLAnalysis {
  const weightGrams = volumeCm3 * densityGPerCm3;
  // Estimate with ~20% infill factor for typical prints
  const effectiveVolume = volumeCm3 * 0.2 + volumeCm3 * 0.1; // infill + walls/top/bottom approximation
  const estimatedPrintTimeHours = Math.max(0.5, volumeCm3 / printSpeedCm3PerHour);

  return {
    volumeCm3: Math.round(volumeCm3 * 100) / 100,
    weightGrams: Math.round(weightGrams * 10) / 10,
    estimatedPrintTimeHours: Math.round(estimatedPrintTimeHours * 10) / 10,
  };
}
