# ─── Stage 1: Build React Frontend ───
FROM node:18-alpine AS frontend-builder
WORKDIR /app/client

# Install dependencies first for better caching
COPY client/package*.json ./
RUN npm install

# Build the project
COPY client/ ./
RUN npm run build


# ─── Stage 2: Serve with Fastapi (Production) ───
FROM python:3.11-slim

# Set timezone, non-interactive env
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn setuptools

# Copy Python backend
COPY bridge/ bridge/
COPY data/ data/
COPY .env .env

# Copy React build artifacts
COPY --from=frontend-builder /app/client/dist /app/client/dist

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "bridge.api_server:app", "--host", "0.0.0.0", "--port", "8000"]
