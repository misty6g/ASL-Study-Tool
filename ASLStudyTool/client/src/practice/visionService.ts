import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';
import {
  NormalizedFrame,
  DominantHand,
  Handedness,
  Landmark3D,
} from './types';
import {
  calculateNormalizationBasis,
  normalizeLandmarkList,
  distance3D,
} from './normalizer';
import { extractHandFeatures, HAND_LANDMARKS } from './featureExtractor';

export class VisionService {
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitializing: boolean = false;
  private previousWrists: Map<string, Landmark3D> = new Map();

  /**
   * Initializes MediaPipe Tasks Vision with local assets, falling back to CDN.
   */
  public async initialize(): Promise<void> {
    if (this.handLandmarker && this.poseLandmarker) return;
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      // 1. Resolve WASM files (try local, fallback to CDN)
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks('/wasm');
      } catch (err) {
        console.warn('Local WASM loading failed, attempting CDN fallback:', err);
        vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
      }

      // 2. Initialize HandLandmarker
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (err) {
        console.warn('Local hand model failed, attempting CDN fallback:', err);
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }

      // 3. Initialize PoseLandmarker
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (err) {
        console.warn('Local pose model failed, attempting CDN fallback:', err);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }

      console.log('MediaPipe Vision successfully initialized.');
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Processes a video frame and produces a normalized representation.
   */
  public processFrame(
    videoElement: HTMLVideoElement,
    timestamp: number,
    dominantHand: DominantHand = 'right'
  ): {
    frame: NormalizedFrame;
    rawPoseLandmarks: Landmark3D[] | null;
    rawHandLandmarks: { handedness: Handedness; landmarks: Landmark3D[] }[];
  } | null {
    if (!this.handLandmarker || !this.poseLandmarker) return null;
    if (videoElement.readyState < 2) return null;

    // Detect pose
    const poseResult = this.poseLandmarker.detectForVideo(videoElement, timestamp);
    const rawPose = poseResult.landmarks && poseResult.landmarks[0] ? (poseResult.landmarks[0] as Landmark3D[]) : null;

    // Detect hands
    const handResult = this.handLandmarker.detectForVideo(videoElement, timestamp);

    // Derive normalization basis
    const basis = calculateNormalizationBasis(rawPose);

    const rawHandList: { handedness: Handedness; landmarks: Landmark3D[] }[] = [];
    const normalizedHands = [];

    if (handResult.landmarks && handResult.handedness) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const rawLm = handResult.landmarks[i] as Landmark3D[];
        // MediaPipe reports categoryName as 'Left' or 'Right'
        const rawCategory = handResult.handedness[i]?.[0]?.categoryName || 'Right';
        const handedness: Handedness = rawCategory === 'Left' ? 'Left' : 'Right';

        rawHandList.push({ handedness, landmarks: rawLm });

        // Normalize hand landmarks relative to body origin and scale
        const normLm = normalizeLandmarkList(rawLm, basis.origin, basis.scale, dominantHand);
        const prevWrist = this.previousWrists.get(handedness);
        const features = extractHandFeatures(normLm, handedness, dominantHand, prevWrist);

        this.previousWrists.set(handedness, normLm[HAND_LANDMARKS.WRIST]);
        normalizedHands.push(features);
      }

      // Robust dominant-hand assignment:
      // 1. If only 1 hand is visible, that hand is ALWAYS the practicing hand!
      if (normalizedHands.length === 1) {
        normalizedHands[0].isDominant = true;
      } else if (normalizedHands.length > 1) {
        // 2. If 2 hands are detected:
        // A) An elevated hand (in signing zone, y < 0.4) takes priority over a hand resting low
        const h0Elevated = normalizedHands[0].wrist.y < 0.4;
        const h1Elevated = normalizedHands[1].wrist.y < 0.4;

        if (h0Elevated && !h1Elevated) {
          normalizedHands[0].isDominant = true;
          normalizedHands[1].isDominant = false;
        } else if (h1Elevated && !h0Elevated) {
          normalizedHands[0].isDominant = false;
          normalizedHands[1].isDominant = true;
        } else if (rawPose && rawPose[15] && rawPose[16]) {
          // B) Match hands to pose wrists (Pose 16 = Right Wrist, Pose 15 = Left Wrist)
          const d0Right = distance3D(rawHandList[0].landmarks[0], rawPose[16]);
          const d0Left = distance3D(rawHandList[0].landmarks[0], rawPose[15]);
          const hand0IsRight = d0Right < d0Left;

          if (dominantHand === 'right') {
            normalizedHands[0].isDominant = hand0IsRight;
            normalizedHands[1].isDominant = !hand0IsRight;
          } else {
            normalizedHands[0].isDominant = !hand0IsRight;
            normalizedHands[1].isDominant = hand0IsRight;
          }
        }

        // Guarantee at least one hand is flagged dominant
        if (!normalizedHands.some(h => h.isDominant)) {
          normalizedHands[0].isDominant = true;
        }
      }
    }

    const frame: NormalizedFrame = {
      timestamp,
      poseLandmarks: rawPose,
      origin: basis.origin,
      scale: basis.scale,
      hands: normalizedHands,
      quality: {
        shouldersVisible: basis.shouldersVisible,
        headVisible: basis.headVisible,
        handsCount: normalizedHands.length,
        isFramedWell: basis.shouldersVisible && (normalizedHands.length > 0 || basis.headVisible),
      },
    };

    return {
      frame,
      rawPoseLandmarks: rawPose,
      rawHandLandmarks: rawHandList,
    };
  }

  /**
   * Draws visual skeleton overlay on canvas.
   */
  public drawLandmarks(
    canvas: HTMLCanvasElement,
    rawPose: Landmark3D[] | null,
    rawHands: { handedness: Handedness; landmarks: Landmark3D[] }[],
    dominantHand: DominantHand
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Draw upper-body pose lines (shoulders & arms)
    if (rawPose && rawPose.length > 16) {
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
      ctx.lineWidth = 3;

      const connect = (idxA: number, idxB: number) => {
        const a = rawPose[idxA];
        const b = rawPose[idxB];
        if (a && b) {
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
        }
      };

      // Shoulder bar
      connect(11, 12);
      // Left arm
      connect(11, 13);
      connect(13, 15);
      // Right arm
      connect(12, 14);
      connect(14, 16);

      // Draw shoulder dots
      ctx.fillStyle = '#4a90e2';
      [11, 12].forEach(idx => {
        const pt = rawPose[idx];
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }

    // Hand connections
    const HAND_CONNECTIONS = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [5, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [9, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [13, 17], [17, 18], [18, 19], [19, 20],
      // Palm base
      [0, 17],
    ];

    rawHands.forEach(hand => {
      const isDom =
        dominantHand === 'left' ? hand.handedness === 'Left' : hand.handedness === 'Right';
      const color = isDom ? '#00e676' : '#ff9100'; // Green for dominant hand, orange for non-dominant

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;

      HAND_CONNECTIONS.forEach(([i, j]) => {
        const p1 = hand.landmarks[i];
        const p2 = hand.landmarks[j];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      });

      // Draw joints
      ctx.fillStyle = '#ffffff';
      hand.landmarks.forEach((pt, idx) => {
        const isTip = [4, 8, 12, 16, 20].includes(idx);
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isTip ? 4 : 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  }

  /**
   * Release resources and clear detectors.
   */
  public dispose(): void {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close();
      } catch (e) {
        // ignore
      }
      this.handLandmarker = null;
    }
    if (this.poseLandmarker) {
      try {
        this.poseLandmarker.close();
      } catch (e) {
        // ignore
      }
      this.poseLandmarker = null;
    }
    this.previousWrists.clear();
  }
}

// Export singleton instance
export const visionService = new VisionService();
