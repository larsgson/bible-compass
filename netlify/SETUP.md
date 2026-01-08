# Netlify Function Setup Guide

This guide explains how to set up the DBT API proxy for local development and Netlify deployment.

## What This Does

The Netlify function acts as a secure proxy to the Digital Bible Platform (DBT) API:
- Solves CORS (Cross-Origin Resource Sharing) issues for browser-based clients
- Keeps your API key secure on the server side
- Handles text, audio, and timecode requests

## Local Development Setup

### 1. Install Dependencies

Make sure you have the Netlify CLI installed:

```bash
npm install -g netlify-cli
```

### 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your DBT API key:

```
DBT_API_KEY=your_actual_api_key_here
DBT_API_BASE_URL=https://4.dbt.io/api
```



**Note**: Never commit the `.env` file to version control. It should be listed in `.gitignore`.

### 3. Run Development Server

Start the Netlify development server:

```bash
netlify dev
```

This will:
- Start the Netlify functions server
- Make functions available at `http://localhost:8888/.netlify/functions/`

The proxy will be available at `http://localhost:8888/.netlify/functions/dbt-proxy`

### 4. Test the Proxy

Once running, you can test the proxy directly:

```bash
# Test text endpoint
curl "http://localhost:8888/.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15"

# Test with browser
# Open: http://localhost:8888/.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15
```

## Netlify Deployment Setup

### 1. Connect Your Repository

1. Log in to [Netlify](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect your Git repository (GitHub, GitLab, etc.)
4. Configure build settings (or use `netlify.toml` if present)

### 2. Configure Environment Variables

In the Netlify dashboard:

1. Go to: **Site settings** → **Environment variables**
2. Click "Add a variable"
3. Add the following:
   - **Key**: `DBT_API_KEY`
   - **Value**: Your DBT API key
   - **Scopes**: Select all (Production, Deploy Previews, Branch deploys)

Optional variable:
   - **Key**: `DBT_API_BASE_URL`
   - **Value**: `https://4.dbt.io/api`

### 3. Deploy

Push your code to your connected Git repository, and Netlify will automatically:
- Deploy the functions
- Make them available at your Netlify URL

## Function Endpoint

Once deployed, your proxy will be available at:

```
https://your-site-name.netlify.app/.netlify/functions/dbt-proxy
```

Configure your client code to use the correct endpoint based on the environment:
- Local: `http://localhost:8888/.netlify/functions/dbt-proxy`
- Production: `https://your-domain/.netlify/functions/dbt-proxy`

## API Usage

### Request Format

```
GET /.netlify/functions/dbt-proxy?type=TYPE&fileset_id=ID&book_id=BOOK&chapter_id=CHAPTER
```

**Parameters:**
- `type`: `text`, `audio`, or `timecode`
- `fileset_id`: Base fileset ID (e.g., `ANYWBTN`)
- `book_id`: Book code (e.g., `REV`, `MAT`, `LUK`)
- `chapter_id`: Chapter number (e.g., `1`, `15`)

### Examples

**Fetch Bible Text:**
```
GET /.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15
```

**Fetch Audio:**
```
GET /.netlify/functions/dbt-proxy?type=audio&fileset_id=ANYWBTN1DA&book_id=MAT&chapter_id=1
```

**Fetch Timecode:**
```
GET /.netlify/functions/dbt-proxy?type=timecode&fileset_id=ANYWBTN1DA&book_id=LUK&chapter_id=2
```

## Troubleshooting

### "API key not configured" Error

**Problem**: The function can't find the API key.

**Solution**: 
- Local: Check that `.env` file exists and contains `DBT_API_KEY`
- Netlify: Verify environment variable is set in Netlify dashboard
- Restart dev server after adding environment variables

### CORS Errors Still Occurring

**Problem**: CORS errors despite using the proxy.

**Solution**:
- Make sure your client is calling `/.netlify/functions/dbt-proxy`, not the DBT API directly
- Check browser console to see which URL is being called
- Verify your client code is using the proxy endpoint

### Function Not Found (404)

**Problem**: `/.netlify/functions/dbt-proxy` returns 404.

**Solution**:
- Check that `netlify.toml` has `functions = "netlify/functions"` (if using netlify.toml)
- Verify the function file exists at `netlify/functions/dbt-proxy.cjs`
- Restart `netlify dev` if running locally
- Check Netlify function logs in dashboard for deployment issues

### Function Timeout

**Problem**: Requests timing out.

**Solution**:
- DBT API might be slow or unavailable
- Check DBT API status
- Netlify functions have a 10-second timeout on free tier

## Moving This Proxy

This proxy is designed to be portable. To move it to another project:

1. Copy `netlify/functions/` directory
2. Copy `.env.example` (if you have one)
3. Copy `netlify.toml` (if you have one)
4. Set up environment variables in new location
5. Update your client code to call the function endpoint

## Security Notes

- API key is never exposed to the client
- Only GET requests are allowed
- CORS is set to allow all origins (adjust for production if needed)
- All requests are logged for debugging

## Getting a DBT API Key

If you don't have a DBT API key:

1. Visit: https://4.dbt.io/
2. Register for an account
3. Request an API key
4. Follow their terms of service

## Support

For issues specific to:
- **DBT API**: Check DBT documentation at https://4.dbt.io/
- **Netlify Functions**: Check Netlify docs at https://docs.netlify.com/functions/overview/