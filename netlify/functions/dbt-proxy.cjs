// Netlify Serverless Function - DBT API Proxy
// Handles requests for Bible text, audio, and timecode data from Digital Bible Platform

// Constants
const VALID_TYPES = ["text", "audio", "timecode"];
const REQUIRED_PARAMS = ["type", "fileset_id", "book_id", "chapter_id"];
const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Helper: Build fileset ID with appropriate suffix based on content type
const buildFilesetId = (type, baseFilesetId) => {
  const suffixes = { text: "_ET", audio: "", timecode: "" };
  return `${baseFilesetId}${suffixes[type]}`;
};

// Helper: Create standardized JSON response with CORS headers
const jsonResponse = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { ...CORS_HEADERS, ...headers },
  body: JSON.stringify(body),
});

// Main handler function
exports.handler = async (event) => {
  // Only accept GET requests
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method Not Allowed" });
  }

  // Get API key from environment
  const apiKey = process.env.DBT_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "API key not configured" });
  }

  // Extract query parameters
  const params = event.queryStringParameters || {};
  const { type, fileset_id, book_id, chapter_id } = params;

  // Validate required parameters are present
  const missing = REQUIRED_PARAMS.filter((p) => !params[p]);
  if (missing.length > 0) {
    return jsonResponse(400, {
      error: "Missing required parameters",
      required: REQUIRED_PARAMS,
      missing,
    });
  }

  // Validate type is one of the allowed values
  if (!VALID_TYPES.includes(type)) {
    return jsonResponse(400, {
      error: "Invalid type parameter",
      allowed: VALID_TYPES,
      received: type,
    });
  }

  try {
    // Get base URL from environment or use default
    const baseUrl = process.env.DBT_API_BASE_URL || "https://4.dbt.io/api";
    let url;
    let response;

    // Timecode uses different endpoint structure: timestamps/{fileset}/{book}/{chapter}
    if (type === "timecode") {
      // Use base fileset ID without any suffix for timecode endpoint
      url = new URL(
        `${baseUrl}/timestamps/${fileset_id}/${book_id}/${chapter_id}`,
      );
      url.searchParams.append("key", apiKey);
      url.searchParams.append("v", "4");

      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } else if (type === "text") {
      // For text, try WITHOUT _ET suffix first (for languages like French)
      url = new URL(
        `${baseUrl}/bibles/filesets/${fileset_id}/${book_id}/${chapter_id}`,
      );
      url.searchParams.append("key", apiKey);
      url.searchParams.append("v", "4");

      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      // If that fails with 404, try WITH _ET suffix (for languages like English)
      if (!response.ok && response.status === 404) {
        const filesetIdWithET = `${fileset_id}_ET`;
        url = new URL(
          `${baseUrl}/bibles/filesets/${filesetIdWithET}/${book_id}/${chapter_id}`,
        );
        url.searchParams.append("key", apiKey);
        url.searchParams.append("v", "4");

        response = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
      }
    } else {
      // Audio uses base fileset ID without suffix
      url = new URL(
        `${baseUrl}/bibles/filesets/${fileset_id}/${book_id}/${chapter_id}`,
      );
      url.searchParams.append("key", apiKey);
      url.searchParams.append("v", "4");

      response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    }

    // Handle non-successful responses
    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse(response.status, {
        error: "DBT API request failed",
        status: response.status,
        statusText: response.statusText,
        details: errorText,
      });
    }

    // Success - return the Bible data
    const data = await response.json();
    return jsonResponse(200, data);
  } catch (error) {
    return jsonResponse(500, {
      error: "Proxy error",
      message: error.message,
    });
  }
};
