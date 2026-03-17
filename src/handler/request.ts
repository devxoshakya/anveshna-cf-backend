import { HonoRequest } from "hono";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "3600",
};

const requiredHeaders: Record<string, string> = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.5",
  origin: "https://rapid-cloud.co",
  Referer: "https://rapid-cloud.co/",
  "Sec-Ch-Ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Brave";v="134"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Gpc": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const fallbackHeaders: Record<string, string> = {
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  origin: "https://megacloud.tv",
  Referer: "https://megacloud.tv/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const minimalHeaders: Record<string, string> = {
  Accept: "*/*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const normalizeTargetUrl = (inputUrl: string, requestUrl: string) => {
  let candidate = inputUrl;

  // Unwrap nested proxy URLs like /fetch?url=... that can appear in playlists.
  for (let i = 0; i < 5; i++) {
    const parsed = new URL(candidate, requestUrl);
    if (parsed.pathname !== "/fetch") {
      return parsed.toString();
    }

    const nestedUrl = parsed.searchParams.get("url");
    if (!nestedUrl) {
      return parsed.toString();
    }
    candidate = nestedUrl;
  }

  return new URL(candidate, requestUrl).toString();
};

export async function RequestHandler({ response }: { response: HonoRequest }) {
  try {
    const { url, ref } = response.query();

    if (!url) {
      return new Response(JSON.stringify({ error: "No URL provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Accept absolute and relative URLs, and unwrap accidental nested /fetch URLs.
    const targetUrl = normalizeTargetUrl(url, response.url);

    const headers = {
      ...requiredHeaders,
      ...(ref ? { Referer: ref } : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const fetchOptions: RequestInit = {
      headers,
      redirect: "follow",
      signal: controller.signal,
      method: "GET",
    };

    const headerProfiles: Record<string, string>[] = [
      minimalHeaders,
      { ...fallbackHeaders, ...(ref ? { Referer: ref } : {}) },
      headers,
    ];

    let fetchedResponse: Response | null = null;
    const attemptedStatuses: number[] = [];
    for (const profile of headerProfiles) {
      fetchedResponse = await fetch(targetUrl, {
        ...fetchOptions,
        headers: profile,
      });
      attemptedStatuses.push(fetchedResponse.status);
      if (fetchedResponse.status !== 204 && fetchedResponse.status !== 403) {
        break;
      }
    }
    clearTimeout(timeoutId);

    if (!fetchedResponse) {
      throw new Error("Failed to fetch target URL");
    }

    if (fetchedResponse.status === 204) {
      return new Response(
        JSON.stringify({
          message: "Upstream returned no content",
          error:
            "Target CDN returned 204 for all proxy attempts from worker network",
          url: targetUrl,
          attempts: attemptedStatuses,
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    if (fetchedResponse.status === 403) {
      return new Response(
        JSON.stringify({
          message: "Access denied by target server",
          error: "The streaming server returned a 403 Forbidden error",
          attempts: attemptedStatuses,
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    let type = fetchedResponse.headers.get("Content-Type") || "text/plain";
    let responseBody: ArrayBuffer | string | null = null;

    if (type.includes("text/vtt")) {
      responseBody = await fetchedResponse.text();

      const regex = /.+?\.(jpg)+/g;
      const matches = [...responseBody.matchAll(regex)];

      const fileNames: string[] = [];
      for (const match of matches) {
        const filename = match[0];
        if (!fileNames.includes(filename)) {
          fileNames.push(filename);
        }
      }

      if (fileNames.length > 0) {
        for (const filename of fileNames) {
          const newUrl = targetUrl.replace(/\/[^\/]*$/, `/${filename}`);
          responseBody = responseBody.replaceAll(
            filename,
            "/fetch?url=" + encodeURIComponent(newUrl)
          );
        }
      }
    } else if (
      type.includes("application/vnd.apple.mpegurl") ||
      type.includes("application/x-mpegurl") ||
      type.includes("video/MP2T") ||
      type.includes("audio/mpegurl") ||
      type.includes("application/x-mpegURL") ||
      type.includes("audio/x-mpegurl") ||
      (type.includes("text/html") &&
        (targetUrl.endsWith(".m3u8") || targetUrl.endsWith(".ts")))
    ) {
      responseBody = await fetchedResponse.text();

      if (!responseBody.startsWith("#EXTM3U")) {
        return new Response(responseBody, {
          headers: corsHeaders,
          status: fetchedResponse.status,
          statusText: fetchedResponse.statusText,
        });
      }

      const regex = /\/[^\/]*$/;
      const urlRegex = /^(?:(?:(?:https?|ftp):)?\/\/)[^\s/$.?#].[^\s]*$/i;
      const m3u8FileChunks = responseBody.split("\n");
      const m3u8AdjustedChunks: string[] = [];

      for (const line of m3u8FileChunks) {
        if (line.startsWith("#") || !line.trim()) {
          m3u8AdjustedChunks.push(line);
          continue;
        }

        let formattedLine = line;
        if (line.startsWith(".")) {
          formattedLine = line.substring(1);
        }

        if (formattedLine.match(urlRegex)) {
          m3u8AdjustedChunks.push(
            `/fetch?url=${encodeURIComponent(formattedLine)}`
          );
        } else {
          const newUrls = targetUrl.replace(
            regex,
            formattedLine.startsWith("/") ? formattedLine : `/${formattedLine}`
          );

          m3u8AdjustedChunks.push(`/fetch?url=${encodeURIComponent(newUrls)}`);
        }
      }

      responseBody = m3u8AdjustedChunks.join("\n");
    } else {
      responseBody = await fetchedResponse.arrayBuffer();
    }

    if (responseBody instanceof ArrayBuffer) {
      const body = new Uint8Array(responseBody);
      if (body.length > 0 && body[0] === 0x47) {
        type = "video/mp2t";
      }
    }

    const responseHeaders = { ...corsHeaders, "Content-Type": type };

    return new Response(responseBody, {
      headers: responseHeaders,
      status: fetchedResponse.status,
      statusText: fetchedResponse.statusText,
    });
  } catch (error: any) {
    let errorMessage = error.message;
    let statusCode = 500;

    if (error.name === "AbortError") {
      errorMessage = "Request timed out";
      statusCode = 504;
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      errorMessage = "Network error when trying to fetch resource";
      statusCode = 502;
    } else if (error.name === "TypeError" && error.message.includes("URL")) {
      errorMessage = "Invalid URL";
      statusCode = 400;
    }

    return new Response(
      JSON.stringify({
        message: "Request failed",
        error: errorMessage,
        url: response.query().url,
      }),
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}
