import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RedirectForm from "@/components/redirect-form";
import RedirectChain from "@/components/redirect-chain";
import { useState } from "react";
import type { RedirectResponse } from "@/shared/schema";

export default function Home() {
  const [response, setResponse] = useState<RedirectResponse | null>(null);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              URL Redirect Analyzer
            </CardTitle>
            <CardDescription>
              Analyze URL redirects and spoof referer headers with automatic redirect chain tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RedirectForm onResponse={setResponse} />
          </CardContent>
        </Card>

        {response && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
              <CardDescription>Showing the complete redirect chain and final destination.</CardDescription>
            </CardHeader>
            <CardContent>
              <RedirectChain response={response} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
