# Netlify Functions - DBT API Proxy

This directory contains Netlify serverless functions that act as a proxy to the Digital Bible Platform (DBT) API.

## Purpose

The proxy function solves two key problems:
1. **CORS Issues**: Direct browser requests to the DBT API are blocked by CORS. The proxy makes server-side requests that bypass CORS restrictions.
2. **API Key Security**: Keeps the DBT API key secure on the server side instead of exposing it in client-side code.

## Functions

### `dbt-proxy.cjs`

Proxies requests to the DBT API for fetching Bible content (text, audio, and timecode data).

**Note:** Uses `.cjs` extension for CommonJS compatibility with ES module projects.

**Endpoint**: `/.netlify/functions/dbt-proxy`

**Method**: `GET`

**Query Parameters**:
- `type` (required): Type of content to fetch
  - `text` - Bible text
  - `audio` - Audio files
  - `timecode` - Timing/timecode data
- `fileset_id` (required): Base fileset ID (e.g., `ANYWBTN`)
- `book_id` (required): Book code (e.g., `REV`, `MAT`, `LUK`)
- `chapter_id` (required): Chapter number (e.g., `1`, `15`)

**Example Requests**:

```bash
# Fetch text for Revelation chapter 15
GET /.netlify/functions/dbt-proxy?type=text&fileset_id=ANYWBTN&book_id=REV&chapter_id=15

# Fetch audio for Matthew chapter 1
GET /.netlify/functions/dbt-proxy?type=audio&fileset_id=ANYWBTN1DA&book_id=MAT&chapter_id=1

# Fetch timecode for Luke chapter 2
GET /.netlify/functions/dbt-proxy?type=timecode&fileset_id=ANYWBTN1DA&book_id=LUK&chapter_id=2
```

**How it Works**:

1. Client makes request to the Netlify function
2. Function validates parameters
3. Function constructs proper fileset ID based on type:
   - Text: `{fileset_id}_ET`
   - Audio: `{fileset_id}` (unchanged)
   - Timecode: `{fileset_id}_timing`
4. Function makes authenticated request to DBT API using server-side API key
5. Function returns response to client with CORS headers

## Setup

### Environment Variables

The proxy requires the DBT API key to be set as an environment variable:

**For Local Development**:
1. Copy `.env.example` to `.env` in the project root
2. Add your DBT API key:
   ```
   DBT_API_KEY=your_actual_api_key_here
   ```

**For Netlify Deployment**:
1. Go to your Netlify site dashboard
2. Navigate to: Site settings > Environment variables
3. Add the following variable:
   - Key: `DBT_API_KEY`
   - Value: Your DBT API key

Optional environment variable:
- `DBT_API_BASE_URL` - DBT API base URL (defaults to `https://4.dbt.io/api`)

### Testing Locally

To test the function locally using Netlify CLI:

```bash
# Install Netlify CLI if not already installed
npm install -g netlify-cli

# Run the dev server
netlify dev

# The function will be available at:
# http://localhost:8888/.netlify/functions/dbt-proxy
```

## Moving This Function

This function is designed to be freestanding and portable. To move it to another project:

1. Copy the entire `netlify/functions` directory
2. Copy `.env.example` (if you have one)
3. Set up environment variables in the new location
4. Update your client code to call the function endpoint

## Dependencies

The function uses Node.js native `fetch` (available in Node.js 18+).

No additional npm packages required - Netlify runs Node 18+ by default.

## Error Handling

The function returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (content not available in DBT API)
- `405` - Method Not Allowed (non-GET requests)
- `500` - Server Error (API key not configured or other errors)

## Security

- API key is stored securely as an environment variable
- Never exposed to client-side code
- CORS headers allow requests from any origin (adjust if needed for production)
- Only GET requests are allowed