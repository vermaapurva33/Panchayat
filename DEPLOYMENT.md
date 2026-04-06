# Panchayat AI: Vultr Deployment Guide

This guide provides a comprehensive, step-by-step walk-through for deploying the Panchayat AI platform onto a Vultr Virtual Private Server (VPS) using Docker Compose.

---

## 1. Provisioning Your Vultr Instance

1. Log into your [Vultr Dashboard](https://my.vultr.com/).
2. Click **Deploy New Server** (+ icon).
3. **Choose Server Type**: "Cloud Compute" or "Optimized Cloud Compute" (depending on budget).
4. **Choose Server Location**: Select a location closest to your target audience (e.g., Mumbai for Indian users).
5. **Choose Image**: Select the **Docker** app image. 
   - *Go to Marketplace Apps -> Search for "Docker" -> Select the Docker image (typically built on Ubuntu/Debian).*
   - *Why?* This comes with Docker and Docker Compose pre-installed, saving you setup time.
6. **Choose Server Size**:
   - Minimum: 1 vCPU, 1GB RAM.
   - Recommended: **1 vCPU, 2GB RAM** (React build process is memory intensive).
7. Select **Deploy Now** and wait for the server status to become "Running". 
8. Copy the **IP Address** and **Root Password** from the Server Details page.

---

## 2. Connecting to Your Server

Open a terminal on your local machine and connect via SSH:

```bash
ssh root@<YOUR_VULTR_IP_ADDRESS>
```
*(Paste the Root Password when prompted)*

---

## 3. Cloning Your Forked Codebase

Once logged into your Vultr server, you'll need to pull the code from **your fork** (and specifically, your feature branch). 

```bash
# Update system packages
apt update && apt upgrade -y

# Clone YOUR forked repository (replace with your actual GitHub URL)
git clone <YOUR_FORK_GITHUB_URL> panchayat

# Enter the directory
cd panchayat

# Switch to the branch you just committed to (e.g., feature/data-personas-and-voters)
git checkout feature/data-personas-and-voters
```

---

## 4. Configuring Environment Variables

Your server needs the API keys from your `.env` file. Do not commit `.env` to GitHub! Instead, create it directly on the server:

```bash
nano .env
```

Paste your production keys into the editor:

```env
GROQ_API_KEY=gsk_your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

# If using Solana Devnet
SOLANA_PRIVATE_KEY=your_base58_private_key_here

ELEVENLABS_API_KEY=your_elevenlabs_key
ARMORIQ_API_KEY=your_armoriq_key
```
Press `Ctrl+O`, `Enter` to save, and `Ctrl+X` to exit.

---

## 5. Building and Deploying the Container

We've already configured a highly optimized `Dockerfile` and `docker-compose.yml` for you. The single container will build the React frontend and serve it securely out of the FastAPI Python backend.

Run the orchestration daemon:

```bash
docker-compose up -d --build
```

**What this does:**
1. **Frontend Build**: Spins up a Node container, installs NPM packages, runs `npm run build`, and generates `client/dist`.
2. **Backend Config**: Spins up a Python container, installs `requirements.txt`.
3. **Merge**: Copies the built React assets into the Python container.
4. **Deploy**: Starts the FastAPI `uvicorn` server, mounting your `/data` directory natively to preserve Solana logs and Shield Audits even if the server reboots!

---

## 6. Accessing It Live

Your game is now live! Simply open a web browser and go to:

```
http://<YOUR_VULTR_IP_ADDRESS>
```

FastAPI will serve your React app on the root `/` endpoint, and all your `/api` endpoints will seamlessly function in the background.

---

## 7. Useful Server Commands (Maintenance)

If you need to manage your application in the future:

**View Live Server Logs (Great for debugging AI API calls):**
```bash
docker-compose logs -f panchayat
```

**Restart the Server:**
```bash
docker-compose restart
```

**Pull New Code and Rebuild:**
```bash
git pull origin main
docker-compose up -d --build
```
