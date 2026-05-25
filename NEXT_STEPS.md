# Production-Readiness Roadmap — Next Steps

This document outlines the critical architectural, security, and machine learning milestones required to transition this local development setup into a production-grade web application.

---

## 1. Production Database Migration

Currently, the application runs a local PostgreSQL service in Docker. For production:
- **Managed Database Service**: Migrate from the Docker container to a managed PostgreSQL service (such as AWS RDS, Neon, Render, Railway, or Supabase). This provides automated backups, high availability, and scaling.
- **Connection Pooling**: Use a pool manager like PgBouncer (native in Neon/Supabase) to handle rapid connection open/close events from serverless/containerized Express servers.
- **Data Retention Policies**: Implement periodic backups and logs rotation (especially for `practice_sessions` table which stores heavy JSON landmarks arrays).

---

## 2. Scalable AI Gesture Processing Pipeline

The FastAPI `ai_service` processes video files using OpenCV and extracts landmarks with MediaPipe. This is highly CPU/GPU intensive.
- **Asynchronous Task Queue (Worker Pattern)**: Currently, the backend calls the AI service synchronously. In production, a user uploading a 10s video shouldn't block the HTTP request thread. Transition to a worker-driven queue:
  1. Client uploads video to server.
  2. Server saves video to cloud storage (e.g., AWS S3) and pushes a job to a queue (e.g., Redis + BullMQ or Celery).
  3. A background worker picks up the job, downloads the video, runs landmark extraction/classification, and updates the database.
  4. The client polls a status endpoint or listens via WebSockets for the completion event.
- **Auto-Scaling Containers**: Deploy the AI service on serverless container hosts like Google Cloud Run or AWS ECS/Fargate, allowing it to scale to zero when inactive and scale up automatically under heavy load.

---

## 3. Training & Replacing the LSTM Model

The TFLite model at `ai_service/models/asl_lstm.tflite` is currently stubbed with a mock classifier. To deploy a real classification model:
- **Dataset**: Use the WLASL (Word-Level American Sign Language) dataset which contains videos of thousands of ASL signs.
- **Landmark Extraction**: Run our `/extract-landmarks` script on all training videos in WLASL to construct a dataset of shape `[samples, frames, 21, 3]`.
- **LSTM Model Training**:
  1. Train a sequence model (LSTM or GRU) in TensorFlow/Keras. Set the input shape to `(60, 63)` (representing 60 frames and 21 joints * 3 coordinates).
  2. Map vocabulary words to output index classes.
  3. Export the trained model and convert it to TFLite format using `tf.lite.TFLiteConverter`.
  4. Save the compiled model to `ASLStudyTool/ai_service/models/asl_lstm.tflite` and verify the index-to-label class mapping in `main.py`.

---

## 4. HTTPS, DNS & Security Configuration

- **SSL Certificates**: Enforce HTTPS across all services. Whitelist only production domains (e.g. Vercel client domains) in the Express CORS options.
- **Environment Secrets**: Never commit `.env` files. Enter them as encrypted secrets in the deployment dashboard of Vercel (client), Render/Railway (server, DB, AI service).
- **JWT Expiry & Storage**: The short-lived `accessToken` (15 min) and `refreshToken` (7 days) cookies are set as `httpOnly` and `SameSite=Strict`. In production, ensure the `secure: true` flag is active so cookies are transmitted strictly over HTTPS.
- **Session Revocation**: Integrate a Redis cache on the backend to maintain a blocklist/whitelist of active refresh tokens, permitting instant user logout or credential revocation.
