# Deploying Adaptive Learning Assistant to Google Cloud Run

This guide provides steps to deploy the application's backend to Google Cloud Run. The frontend can be hosted using Firebase Hosting or Cloud Storage, but we will focus on the main Dockerized backend component.

## Prerequisites

1.  **Google Cloud Platform (GCP) Account:** You must have an active GCP account and billing enabled.
2.  **Google Cloud CLI (`gcloud`):** Installed and authenticated on your local machine (`gcloud auth login`).
3.  **Project Created:** A GCP project created and selected (`gcloud config set project [YOUR_PROJECT_ID]`).

## Steps to Deploy

### 1. Enable Required Services
Ensure that Cloud Build, Artifact Registry, and Cloud Run are enabled for your project:
```bash
gcloud services enable cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com
```

### 2. Create Artifact Registry Repository
Create a Docker repository to store your backend images:
```bash
gcloud artifacts repositories create adaptive-learning-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for the Adaptive Learning Backend"
```

### 3. Build and Push the Docker Image
Navigate to the `backend` directory containing the `Dockerfile`:
```bash
cd backend
```
Build the image using Google Cloud Build and push it directly to the Artifact Registry:
```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/adaptive-learning-repo/backend-api:latest
```

### 4. Deploy to Cloud Run
Deploy the container to Cloud Run. Make sure to pass your `GEMINI_API_KEY` securely.
```bash
gcloud run deploy adaptive-learning-backend \
    --image us-central1-docker.pkg.dev/[YOUR_PROJECT_ID]/adaptive-learning-repo/backend-api:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars GEMINI_API_KEY="your_actual_gemini_api_key_here",DEBUG="False",ALLOWED_HOSTS="*"
```

### 5. Frontend Deployment (Optional)
To deploy the React frontend:
1. Navigate to the `frontend` directory.
2. Build the project: `npm run build`
3. Update the `.env` or configuration file to point to the new Cloud Run backend URL.
4. Deploy the `dist` folder to your preferred static hosting platform (e.g., Firebase Hosting, Vercel, Netlify).

## Testing the Deployment
Once deployed, the `gcloud run deploy` command will output a service URL (e.g., `https://adaptive-learning-backend-xyz.a.run.app`).

You can test the deployment by sending a POST request to the `/api/learn/` endpoint:
```bash
curl -X POST https://[YOUR_CLOUD_RUN_URL]/api/learn/ \
-H "Content-Type: application/json" \
-d '{
    "topic": "Python",
    "user_level": "Beginner",
    "step": 1,
    "learning_path": [],
    "last_question": "",
    "user_answer": ""
}'
```
