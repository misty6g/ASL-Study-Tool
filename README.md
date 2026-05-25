# ASL Study Tool

An AI-powered American Sign Language (ASL) flashcard study application. Users can review vocabulary, test their comprehension, record their sign gestures using webcams or uploads, and receive real-time biomechanical feedback and coaching tips powered by MediaPipe and Gemini 1.5 Flash.

---

## Architecture Diagram

```mermaid
graph TD
    Client[React Frontend] <-->|HTTP/Cookies| Backend[Express Backend]
    Backend <-->|SQL| DB[(PostgreSQL Database)]
    Backend -->|HTTP / X-Internal-Secret| AIService[FastAPI AI Service]
    AIService -->|Landmarks Comparison| AIService
    AIService <-->|Biomechanical Assessment| Gemini[Google Gemini 1.5 Flash]
```

---

## Key Features

1. **Vocabulary Decks & Flashcards**: Categorized study decks featuring video demonstrations of ASL signs.
2. **Review Tests**: Interactive, randomized sign quizzes with automated starring of incorrect answers.
3. **AI Sign Practice**: Directly record signs via webcam or upload files.
4. **Biomechanical Coaching Feedback**:
   - **Hand Landmark Tracking**: Extracts 21 3D landmarks per frame from video attempts using MediaPipe Hands.
   - **LSTM Classification**: Stubbed classifier ready to process 60-frame landmark sequences.
   - **MAE Deviation Comparison**: Calculates Mean Absolute Error deviation per joint against reference templates.
   - **Gemini AI Coaching**: Returns structured overall scores, biomechanical corrections for the 3 joints with highest error, and encouraging coach assessments.
5. **Secure Authentication**: Production-ready registration, login, and token refreshes utilizing JWTs stored inside `httpOnly` secure cookies.

---

## Prerequisites

- **Node.js**: v20+
- **Python**: v3.11 (MediaPipe does not currently support Python 3.13)
- **Docker & Docker Compose**: Optional (recommended for zero-config startup)

---

## Environment Variables Reference

Create a `.env` file in the respective service directories.

### Backend Express Server (`ASLStudyTool/server/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Listening port for the API server | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://asl_user:asl_password@localhost:5432/asl_study_tool` |
| `JWT_SECRET` | Secret key for signing session tokens | *Generate a secure string* |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens | *Generate a secure string* |
| `AI_SERVICE_URL` | Base URL of the Python AI microservice | `http://localhost:8000` |
| `AI_SERVICE_SECRET` | Secret key for backend -> AI auth | `supersecretinternalapikey123` |
| `CORS_ORIGIN` | Allowed origin for frontend requests | `http://localhost:3000` |

### Frontend Client (`ASLStudyTool/client/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `REACT_APP_API_URL` | The URL of the backend API server | `http://localhost:8080` |

### AI Microservice (`ASLStudyTool/ai_service/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google AI Studio Gemini API Key | *AI Studio Key* |
| `AI_SERVICE_SECRET` | Shared secret matching server configuration | `supersecretinternalapikey123` |
| `ALLOWED_ORIGIN` | Allowed origin for backend calls | `http://localhost:8080` |

---

## Local Development Setup

### Option A: Using Docker Compose (Recommended)

1. Ensure Docker is running.
2. In the root directory, create a `.env` file containing:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Run the compose file:
   ```bash
   docker-compose up --build
   ```
4. Access the React app at `http://localhost:3000`.

### Option B: Manual Setup (Without Docker)

#### 1. Setup the Database
Install and start a local PostgreSQL server. Create a database named `asl_study_tool`.

#### 2. Start the FastAPI AI Microservice
Ensure you are using **Python 3.11**.
```bash
cd ASLStudyTool/ai_service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Copy environment variables and fill GEMINI_API_KEY
cp .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### 3. Start the Express Backend
```bash
cd ASLStudyTool/server
# Copy environment variables and configure secrets/db URL
cp .env.example .env
npm install
npm run dev
```
*(On startup, the server automatically executes the migration schemas and imports seed vocabulary flashcards.)*

#### 4. Start the React Frontend
```bash
cd ASLStudyTool/client
cp .env.example .env
npm install
npm start
```

---

## Training and Deploying the LSTM Classifier

The sequence classifier in the FastAPI service utilizes a TensorFlow Lite LSTM model (`ASLStudyTool/ai_service/models/asl_lstm.tflite`). 

To train and replace the mock model:
1. **Download Training Videos**: Download vocabulary gesture videos from the [WLASL Dataset](https://github.com/dxli94/WLASL).
2. **Extract Keypoints**: Run our `/extract-landmarks` endpoint on the video dataset to produce keypoint coordinate arrays.
3. **Train Model**: Train a Keras LSTM/GRU network with input dimensions of `(60, 63)` (representing 60 resampled frames, and 21 joints * 3 coordinates).
4. **Convert to TFLite**: Convert the `.h5`/SavedModel artifact to TFLite format using `tf.lite.TFLiteConverter`.
5. **Deploy**: Drop the resulting model file into `ASLStudyTool/ai_service/models/asl_lstm.tflite`. The AI service will automatically swap from the mock classifier to the real model.

---

## Deployment Guide

- **Frontend (Vercel)**: Connect your repository, set the build command to `npm run build` with output directory `build`, and define `REACT_APP_API_URL` pointing to your hosted Express backend.
- **Backend (Render / Railway)**: Deploy as a Node service. Provide the database connection URL and your JWT secrets. The Express backend will auto-migrate your database on boot.
- **AI Microservice (Railway / Render)**: Deploy as a Python/Docker service using the provided Dockerfile. Set the `GEMINI_API_KEY` and the `AI_SERVICE_SECRET`. Ensure the service is kept internal so it is not publicly reachable.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## License

[MIT](LICENSE)