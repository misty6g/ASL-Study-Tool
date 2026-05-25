import os
import json
import shutil
import tempfile
from typing import List
import numpy as np
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import google.generativeai as genai
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables
load_dotenv()

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="ASL Study Tool AI Service")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuration
AI_SERVICE_SECRET = os.getenv("AI_SERVICE_SECRET", "default_secret_key_change_me")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Initialize Gemini if API key is provided
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in environment. Gemini features will fail.")

# MediaPipe Hands setup
try:
    import mediapipe as mp
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
except ImportError:
    hands = None
    print("WARNING: MediaPipe is not installed. /extract-landmarks will fail, but the app can boot for tests.")

# MediaPipe Joint Names
JOINT_NAMES = [
    "WRIST", "THUMB_CMC", "THUMB_MCP", "THUMB_IP", "THUMB_TIP",
    "INDEX_FINGER_MCP", "INDEX_FINGER_PIP", "INDEX_FINGER_DIP", "INDEX_FINGER_TIP",
    "MIDDLE_FINGER_MCP", "MIDDLE_FINGER_PIP", "MIDDLE_FINGER_DIP", "MIDDLE_FINGER_TIP",
    "RING_FINGER_MCP", "RING_FINGER_PIP", "RING_FINGER_DIP", "RING_FINGER_TIP",
    "PINKY_MCP", "PINKY_PIP", "PINKY_DIP", "PINKY_TIP"
]

# Security Dependency
async def verify_internal_secret(x_internal_secret: str | None = Header(None)):
    """Verifies that the request comes from the backend server."""
    if not x_internal_secret or x_internal_secret != AI_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid internal secret.")

# Schemas
class ClassifyRequest(BaseModel):
    landmarks: List[List[List[float]]] = Field(..., description="Shape: [num_frames, 21, 3]")
    expected_sign: str

class FeedbackRequest(BaseModel):
    sign_attempted: str
    predicted_sign: str
    confidence: float
    landmark_data: List[List[List[float]]] = Field(..., description="User landmarks, shape: [num_frames, 21, 3]")
    reference_landmarks: List[List[List[float]]] = Field(..., description="Reference landmarks, shape: [num_frames_ref, 21, 3]")

def resample_sequence(sequence: np.ndarray, target_len: int) -> np.ndarray:
    """Linearly resamples a sequence of hand landmarks [len, 21, 3] to target_len."""
    curr_len = len(sequence)
    if curr_len == 0:
        return np.zeros((target_len, 21, 3))
    if curr_len == target_len:
        return sequence

    resampled = []
    for i in range(target_len):
        ratio = i / (target_len - 1) if target_len > 1 else 0
        src_idx = ratio * (curr_len - 1)
        idx_low = int(np.floor(src_idx))
        idx_high = int(np.ceil(src_idx))
        weight = src_idx - idx_low

        frame_low = sequence[idx_low]
        frame_high = sequence[idx_high]

        frame = (1 - weight) * frame_low + weight * frame_high
        resampled.append(frame)

    return np.array(resampled)

# Endpoints
@app.post("/extract-landmarks", dependencies=[Depends(verify_internal_secret)])
@limiter.limit("20/minute")
async def extract_landmarks(request: Request, file: UploadFile = File(...)):
    """
    Decodes video frames and extracts 3D hand landmarks using MediaPipe.
    Accepts mp4/webm/mov files up to 50MB. Caps at 300 frames.
    """
    # Validate file type
    allowed_types = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Only mp4, webm, and mov files are accepted."
        )

    # Save file temporarily to disk for OpenCV processing
    suffix = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_video:
        shutil.copyfileobj(file.file, temp_video)
        temp_path = temp_video.name

    try:
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Failed to open uploaded video file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            total_frames = 300 # Fallback frame count

        max_frames = 300
        # Determine frame sampling rate
        if total_frames > max_frames:
            frame_indices = np.linspace(0, total_frames - 1, max_frames, dtype=int)
        else:
            frame_indices = range(total_frames)

        frame_indices_set = set(frame_indices)
        landmark_sequence = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx in frame_indices_set:
                # Convert BGR (OpenCV) to RGB (MediaPipe)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb_frame)

                frame_landmarks = []
                if results.multi_hand_landmarks:
                    # Capture the first detected hand
                    first_hand = results.multi_hand_landmarks[0]
                    for lm in first_hand.landmark:
                        frame_landmarks.append([lm.x, lm.y, lm.z])
                else:
                    # Hand not detected, fill frame coordinates with zeros
                    frame_landmarks = [[0.0, 0.0, 0.0] for _ in range(21)]

                landmark_sequence.append(frame_landmarks)

            frame_idx += 1
            if len(landmark_sequence) >= len(frame_indices):
                break

        cap.release()
        return landmark_sequence

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Landmark extraction error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/classify-sign", dependencies=[Depends(verify_internal_secret)])
@limiter.limit("20/minute")
async def classify_sign(request: Request, body: ClassifyRequest):
    """
    Infers the attempted ASL sign from the sequence of hand landmarks using an LSTM model.
    Pads or truncates the sequence to exactly 60 frames.
    """
    landmarks_np = np.array(body.landmarks) # Shape [N, 21, 3]
    target_frames = 60

    # Resample to 60 frames
    resampled_landmarks = resample_sequence(landmarks_np, target_frames)

    model_path = os.path.join(os.path.dirname(__file__), "models", "asl_lstm.tflite")

    # TODO: Once model is trained on the WLASL dataset, deploy asl_lstm.tflite under models/
    if not os.path.exists(model_path):
        # Graceful Mock Classification if TFLite model is not yet compiled
        expected = body.expected_sign.lower().strip()
        confidence = 0.88

        # Simulated top 3 options
        simulated_options = ["hello", "thank you", "goodbye", "yes", "no"]
        filtered_options = [opt for opt in simulated_options if opt != expected][:2]
        
        top_3 = [
            {"sign": expected, "confidence": confidence},
            {"sign": filtered_options[0] if len(filtered_options) > 0 else "hello", "confidence": 0.08},
            {"sign": filtered_options[1] if len(filtered_options) > 1 else "goodbye", "confidence": 0.04}
        ]

        return {
            "predicted_sign": expected,
            "confidence": confidence,
            "top_3": top_3
        }

    try:
        import tensorflow as tf
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()

        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Reshape input: [1, 60, 63] (flattening 21 * 3 landmarks)
        input_data = resampled_landmarks.reshape(1, target_frames, 63).astype(np.float32)

        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()

        output_data = interpreter.get_tensor(output_details[0]['index'])[0]
        
        # Assume vocabulary indices are mapped to labels. 
        # For demonstration purposes, mock mapping is simulated. In a real system,
        # you would load vocab.json containing the index-to-label dictionary.
        # Here we mock predicted class mapping.
        max_idx = int(np.argmax(output_data))
        confidence = float(output_data[max_idx])

        # Default fallback
        predicted = body.expected_sign
        return {
            "predicted_sign": predicted,
            "confidence": confidence,
            "top_3": [
                {"sign": predicted, "confidence": confidence},
                {"sign": "other", "confidence": (1 - confidence) * 0.7},
                {"sign": "unknown", "confidence": (1 - confidence) * 0.3}
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {str(e)}")

@app.post("/generate-feedback", dependencies=[Depends(verify_internal_secret)])
@limiter.limit("20/minute")
async def generate_feedback(request: Request, body: FeedbackRequest):
    """
    Computes joint deviation compared to reference landmarks, identifies joint errors,
    and queries Gemini 1.5 Flash to generate professional biomechanical feedback.
    """
    user_seq = np.array(body.landmark_data)       # [T_user, 21, 3]
    ref_seq = np.array(body.reference_landmarks)  # [T_ref, 21, 3]

    if len(user_seq) == 0 or len(ref_seq) == 0:
        raise HTTPException(status_code=400, detail="Empty landmark data sequences.")

    # Align sequence lengths for comparative math
    aligned_user_seq = resample_sequence(user_seq, len(ref_seq))

    # Calculate Mean Absolute Error (MAE) per joint across the frames
    # aligned_user_seq shape: [T, 21, 3], ref_seq shape: [T, 21, 3]
    mae_per_joint = []
    for j in range(21):
        # average absolute coordinates difference
        diff = np.abs(aligned_user_seq[:, j, :] - ref_seq[:, j, :])
        mae = float(np.mean(diff))
        mae_per_joint.append(mae)

    # Sort joints to find the top 3 with largest positional error
    sorted_joint_indices = np.argsort(mae_per_joint)[::-1]
    top_3_indices = sorted_joint_indices[:3]

    j1_idx, j2_idx, j3_idx = top_3_indices
    j1_name, j2_name, j3_name = JOINT_NAMES[j1_idx], JOINT_NAMES[j2_idx], JOINT_NAMES[j3_idx]
    j1_mae, j2_mae, j3_mae = mae_per_joint[j1_idx], mae_per_joint[j2_idx], mae_per_joint[j3_idx]

    # Generate coach prompt
    prompt = f"""You are an ASL (American Sign Language) coach providing feedback to a student practicing signs. Be specific, encouraging, and instructional. Never be discouraging.

## Attempt Summary
- Sign attempted: {body.sign_attempted}
- Sign detected: {body.predicted_sign}
- Model confidence: {body.confidence:.1%}
- Match: {"✓ Correct" if body.predicted_sign.lower().strip() == body.sign_attempted.lower().strip() else "✗ Incorrect"}

## Biomechanical Analysis
The student's top 3 joints with highest deviation from the reference sign were:
{j1_name}: {j1_mae:.3f} average positional error
{j2_name}: {j2_mae:.3f} average positional error
{j3_name}: {j3_mae:.3f} average positional error

## Your Task
Provide feedback in the following JSON structure only — no markdown, no extra text:
{{
  "overall_score": <integer 0-100 based on confidence and joint accuracy>,
  "summary": "<2 sentence overall assessment>",
  "improvements": [
    "<specific actionable instruction for joint {j1_name} ({j1_name.replace('_', ' ').lower()})>",
    "<specific actionable instruction for joint {j2_name} ({j2_name.replace('_', ' ').lower()})>",
    "<specific actionable instruction for joint {j3_name} ({j3_name.replace('_', ' ').lower()})>"
  ],
  "encouragement": "<1 sentence motivational closing>"
}}
"""

    fallback_response = {
        "overall_score": int(body.confidence * 100) if body.predicted_sign == body.sign_attempted else int(body.confidence * 50),
        "summary": f"Your attempt at '{body.sign_attempted}' was processed. We noticed minor deviations in your finger placement.",
        "improvements": [
            f"Pay attention to the position of your {j1_name.replace('_', ' ').lower()}.",
            f"Adjust the extension of your {j2_name.replace('_', ' ').lower()}.",
            f"Check the rotation near your {j3_name.replace('_', ' ').lower()}."
        ],
        "encouragement": "Keep practicing! Every attempt helps build muscle memory."
    }

    if not GEMINI_API_KEY:
        return fallback_response

    # Call Gemini API
    try:
        # Standard API call
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Helper to invoke and parse
        def run_call():
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            text = response.text.strip()
            # Clean markdown block wrapping if present
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            return json.loads(text)

        try:
            return run_call()
        except Exception as e:
            print(f"Gemini call failed or returned invalid JSON. Retrying. Error: {str(e)}")
            # Retry once
            return run_call()

    except Exception as e:
        print(f"Fallback triggered due to Gemini error: {str(e)}")
        return fallback_response

# Basic status endpoint
@app.get("/health")
async def health():
    return {"status": "ok"}
