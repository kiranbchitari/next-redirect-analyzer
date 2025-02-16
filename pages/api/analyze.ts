import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { redirectRequestSchema, type RedirectResponse } from "@/shared/schema";
import { z } from "zod";
import https from "https";

// Chrome 121 TLS ciphers and settings
const tlsConfig = {
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  cipherSuites: [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384'
  ]
};

// Chrome 121 headers and fingerprint
const BROWSER_PROFILES = {
  chrome: {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Ch-Ua-Platform-Version": '"15.0.0"',
      "Sec-Ch-Ua-Arch": '"x86"',
      "Sec-Ch-Ua-Bitness": '"64"',
      "Sec-Ch-Ua-Full-Version": '"121.0.6167.161"',
      "Sec-Ch-Ua-Full-Version-List": '"Not A(Brand";v="99.0.0.0", "Google Chrome";v="121.0.6167.161", "Chromium";v="121.0.6167.161"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Priority": "u=0, i",
      "Upgrade-Insecure-Requests": "1",
    },
    jsFingerprint: {
      platform: "Win32",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      language: "en-US",
      languages: ["en-US", "en"],
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
    }
  }
};

// Headers that should not be forwarded
const EXCLUDED_HEADERS = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
  "host",
  "authorization",
  "cookie",
  "set-cookie",
]);

type ReferrerPolicy = 
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "same-origin"
  | "origin"
  | "strict-origin"
  | "origin-when-cross-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";

function shouldSendReferrer(
  currentUrl: URL,
  targetUrl: URL,
  referrerPolicy: ReferrerPolicy,
  referrer: string
): string | null {
  if (referrerPolicy === "no-referrer") {
    return null;
  }

  const referrerUrl = new URL(referrer);
  const isSameOrigin = currentUrl.origin === targetUrl.origin;
  const isDowngrade = 
    currentUrl.protocol === "https:" && targetUrl.protocol === "http:";

  switch (referrerPolicy) {
    case "no-referrer-when-downgrade":
      return isDowngrade ? null : referrer;

    case "same-origin":
      return isSameOrigin ? referrer : null;

    case "origin":
      return referrerUrl.origin;

    case "strict-origin":
      return isDowngrade ? null : referrerUrl.origin;

    case "origin-when-cross-origin":
      return isSameOrigin ? referrer : referrerUrl.origin;

    case "strict-origin-when-cross-origin":
      if (isSameOrigin) return referrer;
      return isDowngrade ? null : referrerUrl.origin;

    case "unsafe-url":
      return referrer;

    default:
      // Default to strict-origin-when-cross-origin per spec
      if (isSameOrigin) return referrer;
      return isDowngrade ? null : referrerUrl.origin;
  }
}

function determineSecFetchSite(prevUrl: URL, currentUrl: URL): string {
  if (prevUrl.hostname === currentUrl.hostname) {
    return "same-origin";
  }
  if (prevUrl.hostname.endsWith(currentUrl.hostname) || currentUrl.hostname.endsWith(prevUrl.hostname)) {
    return "same-site";
  }
  return "cross-site";
}

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !EXCLUDED_HEADERS.has(key.toLowerCase()))
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)])
  );
}

function processRedirectHeaders(
  currentHeaders: Record<string, string>,
  newHeaders: Record<string, unknown>,
  currentUrl: string,
  nextUrl: string
): Record<string, string> {
  const processedHeaders = { ...currentHeaders };
  
  // Parse URLs
  const currentUrlObj = new URL(currentUrl);
  const nextUrlObj = new URL(nextUrl);
  
  // Get referrer policy from response headers (case-insensitive)
  const referrerPolicy = (
    newHeaders["referrer-policy"] || 
    newHeaders["Referrer-Policy"] || 
    "strict-origin-when-cross-origin"
  ).toLowerCase() as ReferrerPolicy;

  // Determine if and how to send referrer
  const referrerToSend = shouldSendReferrer(
    currentUrlObj,
    nextUrlObj,
    referrerPolicy,
    currentUrl
  );

  if (referrerToSend) {
    processedHeaders["Referer"] = referrerToSend;
  } else {
    delete processedHeaders["Referer"];
  }
  
  // Update Sec-Fetch-Site based on URL relationship
  processedHeaders["Sec-Fetch-Site"] = determineSecFetchSite(currentUrlObj, nextUrlObj);
  
  // Copy other safe headers
  for (const [key, value] of Object.entries(newHeaders)) {
    const lowerKey = key.toLowerCase();
    if (!EXCLUDED_HEADERS.has(lowerKey)) {
      processedHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
  }

  return processedHeaders;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { url, referer } = redirectRequestSchema.parse(req.body);
    const redirectChain: RedirectResponse["redirectChain"] = [];
    let currentUrl = url;
    let finalResponse;

    // Create HTTPS agent with Chrome TLS configuration
    const httpsAgent = new https.Agent({
      ...tlsConfig,
      keepAlive: true,
    });

    // Initialize headers with Chrome profile and custom referer
    let currentHeaders = {
      ...BROWSER_PROFILES.chrome.headers,
      ...(referer && { 
        Referer: referer,
        "Sec-Fetch-Site": new URL(referer).hostname === new URL(url).hostname ? "same-origin" : "cross-site",
      })
    };

    const axiosInstance = axios.create({
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      timeout: 30000,
      decompress: true,
      httpsAgent,
      transitional: {
        clarifyTimeoutError: true,
        forcedJSONParsing: true,
        silentJSONParsing: true,
      },
    });

    const MAX_REDIRECTS = 20;
    let redirectCount = 0;
    const previousUrls = new Set([currentUrl]);

    while (redirectCount < MAX_REDIRECTS) {
      try {
        console.log(`[${redirectCount + 1}] Requesting: ${currentUrl}`);
        
        const urlObj = new URL(currentUrl);
        
        // Update Sec-Fetch-Site based on redirect chain
        if (redirectCount > 0) {
          const prevUrlObj = new URL(redirectChain[redirectChain.length - 1].url);
          currentHeaders["Sec-Fetch-Site"] = determineSecFetchSite(prevUrlObj, urlObj);
        }

        finalResponse = await axiosInstance.get(currentUrl, {
          headers: currentHeaders,
          validateStatus: (status) => status >= 200 && status < 400,
        });

        redirectChain.push({
          url: currentUrl,
          headers: sanitizeHeaders(finalResponse.headers),
          statusCode: finalResponse.status,
        });

        if (finalResponse.status < 300) {
          console.log(`Final destination reached: ${currentUrl}`);
          break;
        }

        if (!finalResponse.headers.location) {
          console.log(`Redirect status ${finalResponse.status} but no Location header`);
          break;
        }

        // Process redirect
        const nextUrl = new URL(finalResponse.headers.location, currentUrl).href;
        
        // Detect redirect loops
        if (previousUrls.has(nextUrl)) {
          throw new Error("Redirect loop detected");
        }
        previousUrls.add(nextUrl);

        currentHeaders = processRedirectHeaders(currentHeaders, finalResponse.headers, currentUrl, nextUrl);
        currentUrl = nextUrl;
        redirectCount++;

      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          const resp = error.response;
          
          if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
            redirectChain.push({
              url: currentUrl,
              headers: sanitizeHeaders(resp.headers),
              statusCode: resp.status,
            });

            const nextUrl = new URL(resp.headers.location, currentUrl).href;
            
            // Detect redirect loops
            if (previousUrls.has(nextUrl)) {
              throw new Error("Redirect loop detected");
            }
            previousUrls.add(nextUrl);

            currentHeaders = processRedirectHeaders(currentHeaders, resp.headers, currentUrl, nextUrl);
            currentUrl = nextUrl;
            redirectCount++;
            continue;
          }
        }
        throw error;
      }
    }

    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects (max: ${MAX_REDIRECTS})`);
    }

    const response: RedirectResponse = {
      redirectChain,
      finalUrl: currentUrl,
      finalHeaders: sanitizeHeaders(finalResponse?.headers || {}),
      finalStatusCode: finalResponse?.status || 0,
    };

    res.json(response);
  } catch (error) {
    console.error("Error processing redirect:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.statusText || error.message;
      return res.status(status).json({ message });
    }
    
    res.status(500).json({ message: error instanceof Error ? error.message : "An unexpected error occurred" });
  }
}