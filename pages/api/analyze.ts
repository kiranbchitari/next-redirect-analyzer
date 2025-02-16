import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { redirectRequestSchema, type RedirectResponse } from "@/shared/schema";
import { z } from "zod";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { url, referer } = redirectRequestSchema.parse(req.body);
    const redirectChain: RedirectResponse["redirectChain"] = [];
    let currentUrl = url;
    let finalResponse;

    let currentHeaders: Record<string, string> = {
      ...(referer && { Referer: referer }),
      "User-Agent": "Mozilla/5.0 (compatible; RedirectAnalyzer/1.0)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    };

    const axiosInstance = axios.create({
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });

    while (true) {
      try {
        finalResponse = await axiosInstance.get(currentUrl, { headers: currentHeaders });

        redirectChain.push({
          url: currentUrl,
          headers: finalResponse.headers as Record<string, string>,
          statusCode: finalResponse.status
        });

        break;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          const resp = error.response;

          if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
            redirectChain.push({
              url: currentUrl,
              headers: resp.headers as Record<string, string>,
              statusCode: resp.status
            });

            currentHeaders = {
              ...currentHeaders,
              ...Object.fromEntries(
                Object.entries(resp.headers as Record<string, string>).filter(([key]) => {
                  const excludedHeaders = ['content-length', 'host', 'connection', 'content-encoding', 'transfer-encoding'];
                  return !excludedHeaders.includes(key.toLowerCase());
                })
              ),
              Referer: referer || currentUrl,
            };

            currentUrl = new URL(resp.headers.location, currentUrl).href;
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    const response: RedirectResponse = {
      redirectChain,
      finalUrl: currentUrl,
      finalHeaders: finalResponse.headers as Record<string, string>,
      finalStatusCode: finalResponse.status
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
    } else if (axios.isAxiosError(error)) {
      res.status(500).json({ message: error.message });
    } else {
      res.status(500).json({ message: "An unexpected error occurred" });
    }
  }
}
