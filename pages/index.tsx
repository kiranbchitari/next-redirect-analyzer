import { useState } from "react";
import { ExternalLink, ArrowDown } from "lucide-react";


interface RedirectResponse {
  redirectChain: { url: string; headers: Record<string, string>; statusCode: number }[];
  finalUrl: string;
  finalHeaders: Record<string, string>;
  finalStatusCode: number;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [referer, setReferer] = useState("");
  const [result, setResult] = useState<RedirectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, referer }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Something went wrong");
      setResult(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-4">Redirect Analyzer</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Enter URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Enter Referer (optional)"
          value={referer}
          onChange={(e) => setReferer(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </form>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      {result && <RedirectChain response={result} />}
    </div>
  );
}

interface RedirectChainProps {
  response: RedirectResponse;
}

function RedirectChain({ response }: RedirectChainProps) {
  return (
    <div className="space-y-6 mt-6">
      <div className="h-[500px] pr-4 border p-4 rounded overflow-y-auto">
        <div className="space-y-4">
          {response.redirectChain.map((redirect, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm px-2 py-1 rounded bg-gray-200">
                      {redirect.statusCode}
                    </span>
                    <a
                      href={redirect.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {redirect.url}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="mt-2">
                    <details className="text-sm">
                      <summary className="cursor-pointer hover:text-blue-600">
                        Response Headers
                      </summary>
                      <div className="mt-2 font-mono text-xs bg-gray-100 p-3 rounded">
                        {Object.entries(redirect.headers).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-blue-600">{key}</span>: {value}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
              {index < response.redirectChain.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowDown className="text-gray-400 h-6 w-6" />
                </div>
              )}
            </div>
          ))}
          <div className="border-t pt-4">
            <div className="font-semibold mb-2">Final Destination</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm px-2 py-1 rounded bg-gray-200">
                {response.finalStatusCode}
              </span>
              <a
                href={response.finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {response.finalUrl}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-2">
              <details className="text-sm">
                <summary className="cursor-pointer hover:text-blue-600">
                  Final Response Headers
                </summary>
                <div className="mt-2 font-mono text-xs bg-gray-100 p-3 rounded">
                  {Object.entries(response.finalHeaders).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-blue-600">{key}</span>: {value}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

