# PRAR App — Deployment Guide

## Overview
- **Frontend**: React app → deployed on **Vercel** (free)
- **Backend**: FastAPI Python → deployed on **Render** (free)
- **Storage**: Browser localStorage (no database needed)

---

## Step 1 — Push to GitHub

1. Create a new GitHub repository (e.g. `prar-app`)
2. Upload the contents of this folder to it
3. Keep `backend/` and `frontend/` as separate folders in the same repo

---

## Step 2 — Deploy the Backend on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Set these options:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
5. Click **Create Web Service**
6. Wait for it to deploy — you'll get a URL like `https://prar-backend-xxxx.onrender.com`
7. Copy that URL

---

## Step 3 — Deploy the Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (free)
2. Click **Add New → Project**
3. Import your GitHub repo
4. Set these options:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - Key: `VITE_BACKEND_URL`
   - Value: your Render URL from Step 2 (e.g. `https://prar-backend-xxxx.onrender.com`)
6. Click **Deploy**
7. Vercel gives you a URL like `https://prar-app-xxxx.vercel.app` — that's your app!

---

## Notes

- **First fetch after inactivity**: Render's free tier sleeps after 15 minutes. The first Fetch Articles call may take 30–60 seconds while the backend wakes up. Subsequent calls in the same session are instant.
- **Job data**: All installment data is saved in your browser's localStorage. Use the **Export Backup** button to save a `.json` file if you want to back up your work or transfer it to another computer.
- **Updating the app**: Push new code to GitHub — Vercel and Render redeploy automatically.

---

## Local Development (optional)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
# Create .env.local with: VITE_BACKEND_URL=http://localhost:8000
npm run dev
```
