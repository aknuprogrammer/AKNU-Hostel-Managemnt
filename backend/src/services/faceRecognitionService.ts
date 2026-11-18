import { Jimp, compareHashes, distance } from 'jimp';

export interface StudentFaceProfile {
  studentId: string;
  rollNumber: string;
  regNumber?: string;
  fullName: string;
  gender: string;
  hostelId?: string;
  hostelName?: string;
  hostelCategory?: string;
  roomNumber?: string;
  bedNumber?: string;
  photoUrl: string;
  pHash: string;
  pixelArray: number[]; // 64x64 = 4096 normalized grayscale pixel values
}

export interface FaceMatchCandidate {
  student: StudentFaceProfile;
  confidence: number; // 0.0 to 1.0
  pHashSimilarity: number;
  distanceSimilarity: number;
  pixelSimilarity: number;
}

export interface FaceRecognitionResult {
  matched: boolean;
  bestMatch?: FaceMatchCandidate;
  allCandidates: FaceMatchCandidate[];
  error?: string;
}

// In-memory cache for fast 1:N biometric lookup without re-decoding DB images every frame
const studentProfileCache = new Map<string, StudentFaceProfile>();
let cacheLastRefreshed = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

/**
 * Standardize and extract face feature matrix (64x64 grayscale normalized grid)
 */
async function processFaceImage(base64OrBuffer: string | Buffer): Promise<{
  img: any;
  pHash: string;
  pixelArray: number[];
} | null> {
  try {
    let buf: Buffer;
    if (typeof base64OrBuffer === 'string') {
      const value = base64OrBuffer.trim();
      if (/^https?:\/\//i.test(value)) {
        const response = await fetch(value, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Photo URL returned HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Photo URL did not return an image');
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > 10 * 1024 * 1024) throw new Error('Photo exceeds the 10 MB limit');
        buf = Buffer.from(arrayBuffer);
      } else {
        const cleanBase64 = value.replace(/^data:image\/[a-z0-9+.-]+;base64,/i, '').trim();
        buf = Buffer.from(cleanBase64, 'base64');
      }
    } else {
      buf = base64OrBuffer;
    }

    if (buf.length < 500) {
      return null;
    }

    const img = await Jimp.read(buf);

    // Preserve the full photo: directory photos may be uploaded or hosted online
    // and do not always frame the face in the exact center of the image.
    img.resize({ w: 64, h: 64 });
    img.greyscale();

    const pHash = img.pHash();

    // Extract 64x64 grayscale pixel array (0.0 to 1.0)
    const pixelArray: number[] = [];
    const bitmapData = img.bitmap.data;
    for (let i = 0; i < bitmapData.length; i += 4) {
      // bitmapData has RGBA channels; greyscale means R=G=B
      pixelArray.push(bitmapData[i] / 255.0);
    }

    return { img, pHash, pixelArray };
  } catch (err: any) {
    console.error('[Face Recognition] Error processing image buffer:', err.message);
    return null;
  }
}

/**
 * Compare two processed face images and compute multi-factor composite similarity
 */
function computeBiometricSimilarity(
  liveImg: any,
  livePHash: string,
  livePixels: number[],
  profileImg: any,
  profilePHash: string,
  profilePixels: number[]
): {
  composite: number;
  pHashSim: number;
  distSim: number;
  pixelSim: number;
} {
  try {
    // 1. Perceptual Hash distance (0.0 = identical, 1.0 = completely different)
    const hashDiff = compareHashes(livePHash, profilePHash);
    const pHashSim = Math.max(0, 1 - hashDiff);

    // 2. Visual distance
    const visualDist = distance(liveImg, profileImg);
    const distSim = Math.max(0, 1 - visualDist);

    // 3. Pixel Normalized Cross-Correlation / Mean Absolute Error
    let sumAbsDiff = 0;
    const len = Math.min(livePixels.length, profilePixels.length);
    for (let i = 0; i < len; i++) {
      sumAbsDiff += Math.abs(livePixels[i] - profilePixels[i]);
    }
    const mae = sumAbsDiff / len; // 0.0 (identical) to 1.0 (opposite)
    const pixelSim = Math.max(0, 1 - mae * 2.2);

    // Composite weighted score:
    // pHash (40%) captures facial landmark geometry
    // Visual distance (35%) captures broad luminance distribution
    // Pixel correlation (25%) captures local intensity alignment
    const composite = (pHashSim * 0.40) + (distSim * 0.35) + (pixelSim * 0.25);

    return {
      composite: Math.min(1.0, Math.max(0.0, composite)),
      pHashSim,
      distSim,
      pixelSim
    };
  } catch (err) {
    return { composite: 0, pHashSim: 0, distSim: 0, pixelSim: 0 };
  }
}

/**
 * Register or update a student's face profile in the biometric engine
 */
export async function indexStudentFace(student: {
  id: string;
  roll_number: string;
  reg_number?: string;
  full_name: string;
  gender: string;
  hostel_id?: string;
  hostel_name?: string;
  hostel_category?: string;
  room_number?: string;
  bed_number?: string;
  photo_url: string;
}): Promise<boolean> {
  if (!student.photo_url) return false;

  const processed = await processFaceImage(student.photo_url);
  if (!processed) return false;

  studentProfileCache.set(student.id, {
    studentId: student.id,
    rollNumber: student.roll_number,
    regNumber: student.reg_number,
    fullName: student.full_name,
    gender: student.gender,
    hostelId: student.hostel_id,
    hostelName: student.hostel_name,
    hostelCategory: student.hostel_category,
    roomNumber: student.room_number,
    bedNumber: student.bed_number,
    photoUrl: student.photo_url,
    pHash: processed.pHash,
    pixelArray: processed.pixelArray
  });

  return true;
}

/**
 * Clear or invalidate cache
 */
export function invalidateFaceCache() {
  studentProfileCache.clear();
  cacheLastRefreshed = 0;
}

/**
 * 1:N Biometric Face Matching Engine
 * Compares an incoming camera frame against all eligible students in the counter's wing/hostel
 */
export async function matchFaceAgainstDirectory(
  liveImageBase64: string,
  eligibleStudents: Array<any>,
  minThreshold = 0.65
): Promise<FaceRecognitionResult> {
  if (!liveImageBase64 || liveImageBase64.length < 500) {
    return {
      matched: false,
      allCandidates: [],
      error: 'Invalid or empty camera frame received.'
    };
  }

  // 1. Process the incoming live camera snapshot
  const liveProcessed = await processFaceImage(liveImageBase64);
  if (!liveProcessed) {
    return {
      matched: false,
      allCandidates: [],
      error: 'Unable to detect a clear face in the camera frame. Please center face within reticle.'
    };
  }

  // 2. Ensure eligible student profiles are indexed
  for (const st of eligibleStudents) {
    if (!st.photo_url) continue;
    if (!studentProfileCache.has(st.id)) {
      await indexStudentFace(st);
    }
  }

  // 3. Perform 1:N matching across all eligible residents
  const candidates: FaceMatchCandidate[] = [];

  for (const st of eligibleStudents) {
    const profile = studentProfileCache.get(st.id);
    if (!profile) continue;

    // Fast check: compare pHash first
    const hashDiff = compareHashes(liveProcessed.pHash, profile.pHash);
    const pHashSim = Math.max(0, 1 - hashDiff);

    // If pHash is too divergent (< 0.40), skip heavy pixel matrix comparison for speed
    if (pHashSim < 0.40) {
      candidates.push({
        student: profile,
        confidence: pHashSim * 0.40,
        pHashSimilarity: pHashSim,
        distanceSimilarity: 0,
        pixelSimilarity: 0
      });
      continue;
    }

    // Reconstruct small 64x64 bitmap for visual distance comparison
    const profileRgba = Buffer.alloc(profile.pixelArray.length * 4);
    profile.pixelArray.forEach((pixel, index) => {
      const value = Math.round(pixel * 255);
      const offset = index * 4;
      profileRgba[offset] = value;
      profileRgba[offset + 1] = value;
      profileRgba[offset + 2] = value;
      profileRgba[offset + 3] = 255;
    });
    const profileImg = await Jimp.fromBitmap({
      data: profileRgba,
      width: 64,
      height: 64
    });

    const score = computeBiometricSimilarity(
      liveProcessed.img,
      liveProcessed.pHash,
      liveProcessed.pixelArray,
      profileImg,
      profile.pHash,
      profile.pixelArray
    );

    candidates.push({
      student: profile,
      confidence: score.composite,
      pHashSimilarity: score.pHashSim,
      distanceSimilarity: score.distSim,
      pixelSimilarity: score.pixelSim
    });
  }

  // Sort candidates by highest confidence first
  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return {
      matched: false,
      allCandidates: [],
      error: 'No registered residents found with biometric photos for this dining wing.'
    };
  }

  const best = candidates[0];

  // Check if best candidate meets confidence threshold
  if (best.confidence >= minThreshold) {
    return {
      matched: true,
      bestMatch: best,
      allCandidates: candidates.slice(0, 5)
    };
  }

  return {
    matched: false,
    bestMatch: best,
    allCandidates: candidates.slice(0, 5),
    error: `Face does not match any registered resident in this hostel wing (highest match: ${Math.round(best.confidence * 100)}%).`
  };
}

