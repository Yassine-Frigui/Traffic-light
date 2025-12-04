# Deployment Guide: Render (Python) + Netlify (React)

## Architecture
```
┌─────────────────┐      WebSocket      ┌─────────────────┐
│   Netlify       │◄──────────────────►│    Render       │
│   (React/3JS)   │    wss://...        │   (Python)      │
│   Frontend      │                     │   WebSocket     │
└─────────────────┘                     └─────────────────┘
```

---

## Step 1: Deploy Python Server to Render

### 1.1 Create a new Web Service on Render
1. Go to [render.com](https://render.com) and sign up/login
2. Click **New** → **Web Service**
3. Connect your GitHub repo or upload code

### 1.2 Configure the service
- **Name**: `traffic-simulator` (or your choice)
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python traffic.py`

### 1.3 Environment Variables (on Render dashboard)
```
PORT=10000
```
(Render typically assigns a port automatically)

### 1.4 Note your Render URL
After deployment, you'll get a URL like:
```
https://traffic-simulator.onrender.com
```
For WebSocket, use:
```
wss://traffic-simulator.onrender.com
```

---

## Step 2: Deploy React Frontend to Netlify

### 2.1 Update the production environment
Edit `.env.production` with your Render WebSocket URL:
```
VITE_WS_URL=wss://traffic-simulator.onrender.com
```

### 2.2 Build the project locally (to test)
```bash
npm run build
```

### 2.3 Deploy to Netlify

**Option A: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

**Option B: Netlify Dashboard**
1. Go to [netlify.com](https://netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Connect your GitHub repo
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### 2.4 Set Environment Variable on Netlify
In Netlify dashboard → Site settings → Environment variables:
```
VITE_WS_URL = wss://traffic-simulator.onrender.com
```

---

## Step 3: Verify Deployment

1. Open your Netlify URL (e.g., `https://your-site.netlify.app`)
2. Open browser DevTools (F12) → Console
3. You should see: `Connected to Python simulation`
4. Traffic lights and vehicles should update in real-time

---

## Troubleshooting

### WebSocket Connection Failed
- Ensure Render service is running (check Render dashboard logs)
- Verify the WebSocket URL uses `wss://` (not `ws://`) for HTTPS
- Check CORS: Render should allow connections from your Netlify domain

### Render Service Sleeping
- Free Render services sleep after 15 min of inactivity
- First request may take 30-60 seconds to wake up
- Consider upgrading to paid plan for always-on

### Build Errors on Netlify
- Ensure `package.json` has correct build script: `"build": "vite build"`
- Check Node version compatibility

---

## Local Development

Run both services locally:

**Terminal 1 - Python WebSocket:**
```bash
python traffic.py
```

**Terminal 2 - React Dev Server:**
```bash
npm run dev
```

Open `http://localhost:5173`

---

## Files Changed for Deployment

| File | Changes |
|------|---------|
| `traffic.py` | Added `HOST=0.0.0.0`, `PORT` from env var |
| `src/ThreeScene.jsx` | WebSocket URL from `VITE_WS_URL` env var |
| `requirements.txt` | Python dependencies for Render |
| `.env.development` | Local WebSocket URL |
| `.env.production` | Production WebSocket URL |
| `netlify.toml` | Netlify build configuration |

---

## Quick Commands Summary

```bash
# Build React for production
npm run build

# Test Python server locally
python traffic.py

# Deploy to Netlify (after installing netlify-cli)
netlify deploy --prod
```
