# Stage 1: Build the React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Runner
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (including libgomp for LightGBM)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend codebase
COPY backend/ ./backend/
# Copy trained models, processed data, and app database
COPY models/ ./models/
COPY data/ ./data/

# Copy compiled frontend static files from Stage 1 into the designated folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 8000
EXPOSE 8000

# Set working directory to backend to run serve.py
WORKDIR /app/backend

# Launch the FastAPI app using Uvicorn
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8000"]
