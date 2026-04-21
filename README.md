# Colleen's Health Dashboard

Your personal health optimization app. Here's exactly how to deploy it.

---

## Step 1 — Get your Anthropic API key

1. Go to https://console.anthropic.com
2. Sign in (or create a free account)
3. Click **API Keys** in the left sidebar
4. Click **Create Key** → name it "Health App" → copy the key
5. Save it somewhere safe — you'll need it in Step 3

---

## Step 2 — Upload this project to GitHub

1. Go to https://github.com and sign in (or create a free account)
2. Click the **+** icon → **New repository**
3. Name it `colleen-health` → click **Create repository**
4. On the next screen, click **uploading an existing file**
5. Drag the entire `colleen-health` folder contents into the upload area
6. Click **Commit changes**

---

## Step 3 — Deploy on Vercel

1. Go to https://vercel.com and sign in with your GitHub account
2. Click **Add New Project**
3. Find `colleen-health` in the list → click **Import**
4. Before clicking Deploy, click **Environment Variables**
5. Add this variable:
   - **Name:** `REACT_APP_ANTHROPIC_KEY`
   - **Value:** paste your API key from Step 1
6. Click **Deploy**
7. Wait about 2 minutes — Vercel builds it automatically
8. You'll get a URL like `colleen-health.vercel.app` — that's your app!

---

## Step 4 — Add to your home screen (Android/Pixel)

1. Open **Chrome** on your Pixel
2. Go to your Vercel URL (e.g. `colleen-health.vercel.app`)
3. Tap the **three dots** (⋮) → **Add to Home Screen**
4. Tap **Add**
5. Done — it's now on your home screen like a real app

---

## Updating the app

If you ever want to change something, edit the files in GitHub and Vercel will automatically redeploy within 2 minutes.

---

## Your data

All your check-in history is saved locally on your device (browser storage). It stays private and never leaves your phone.
