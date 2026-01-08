# Quick Start Guide - DBT API Proxy

Get up and running in 5 minutes!

## What You Need

1. A DBT API key from https://4.dbt.io/
2. Node.js installed (v18 or later recommended)
3. Netlify CLI: `npm install -g netlify-cli`

## Local Development (3 Steps)

### 1. Set Up Environment Variables

Create `.env` file in project root:

```bash
DBT_API_KEY=your_actual_api_key_here
```

### 2. Start Development Server

```bash
netlify dev
```

This starts the proxy function at `http://localhost:8888`

### 3. Test It Works

Open another terminal and run:

```bash
curl "http://localhost:8888/.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15"
```

You should see JSON data returned!

## Deploy to Netlify (3 Steps)

### 1. Connect Your Repo

1. Push code to GitHub/GitLab
2. Go to https://app.netlify.com
3. Click "Add new site" → "Import an existing project"
4. Connect your repository

### 2. Add Environment Variable

In Netlify dashboard:
1. Go to: **Site settings** → **Environment variables**
2. Click "Add a variable"
3. Add: `DBT_API_KEY` = `your_api_key`

### 3. Deploy

Push to your Git repo - Netlify auto-deploys!

Your proxy will be live at:
```
https://your-site.netlify.app/.netlify/functions/dbt-proxy
```

## How to Use the Proxy

The proxy handles three types of requests:

- Text requests: `?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15`
- Audio requests: `?type=audio&fileset_id=ANYWBTN1DA&book_id=MAT&chapter_id=1`
- Timecode requests: `?type=timecode&fileset_id=ANYWBTN1DA&book_id=LUK&chapter_id=2`

Call the proxy from your frontend code to avoid CORS errors!

## Testing

Test the proxy with curl:

```bash
# Local
curl "http://localhost:8888/.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15"

# Production
curl "https://your-site.netlify.app/.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15"
```

## Troubleshooting

**"API key not configured" error?**
- Make sure `.env` file exists with `DBT_API_KEY=...`
- Restart `netlify dev` after creating `.env`

**Function not found (404)?**
- Check you're running `netlify dev`

**Still getting CORS errors?**
- Make sure your client is calling `/.netlify/functions/dbt-proxy`, not `4.dbt.io` directly

## Need More Help?

- Full setup guide: `netlify/SETUP.md`
- Function documentation: `netlify/functions/README.md`

## That's It!

You're ready to fetch Bible text, audio, and timecode without CORS issues! 🎉