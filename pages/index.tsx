import { useState } from "react";
import { ExternalLink, ArrowDown, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 max-w-3xl space-y-6">
      <Card className="shadow-xl border border-gray-200 rounded-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent text-center">
            URL Referer Spoofer
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
          Analyze URL redirections and simulate requests with custom referers for testing and debugging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Target URL</label>
              <Input 
                placeholder="https://example.com" 
                value={url} 
                onChange={(e) => setUrl(e.target.value)} 
                required 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Referer (Optional)</label>
              <Input 
                placeholder="https://referrer.com" 
                value={referer} 
                onChange={(e) => setReferer(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-purple-600 text-white font-semibold rounded-lg py-2 hover:opacity-90 transition" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Redirects"
              )}
            </Button>
          </form>
          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </CardContent>
      </Card>
      {result && (
        <Card className="shadow-xl border border-gray-200 rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Analysis Results</CardTitle>
            <CardDescription className="text-gray-600">Full redirect chain and final destination.</CardDescription>
          </CardHeader>
          <CardContent>
            <RedirectChain response={result} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return "bg-green-400 text-white";
  if (status >= 300 && status < 400) return "bg-blue-400 text-white";
  if (status >= 400 && status < 500) return "bg-yellow-400 text-black";
  return "bg-red-500 text-white";
};

function RedirectChain({ response }: { response: RedirectResponse }) {
  return (
    <ScrollArea className="h-[450px] border rounded-lg p-4 bg-gray-50">
      <div className="space-y-6">
        {response.redirectChain.map((redirect, index) => (
          <div key={index} className="space-y-3 bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`px-3 py-1 rounded-lg font-mono ${getStatusColor(redirect.statusCode)}`}>
                {redirect.statusCode}
              </span>
              <a href={redirect.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all">
                {redirect.url} <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-700 hover:text-blue-600">Response Headers</summary>
              <div className="mt-2 p-3 bg-gray-100 rounded-lg font-mono text-xs">
                {Object.entries(redirect.headers).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-blue-600">{key}</span>: {value}
                  </div>
                ))}
              </div>
            </details>
            {index < response.redirectChain.length - 1 && <ArrowDown className="text-gray-400 h-6 w-6 mx-auto" />}
          </div>
        ))}
        <Separator />
        <div className="font-semibold text-lg text-gray-700">Final Destination</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-lg font-mono ${getStatusColor(response.finalStatusCode)}`}>
            {response.finalStatusCode}
          </span>
          <a href={response.finalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all">
            {response.finalUrl} <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </ScrollArea>
  );
}