import { useState } from "react";
import axios from "axios";

export default function RedirectForm({ onResponse }: { onResponse: (data: any) => void }) {
  const [url, setUrl] = useState("");
  const [referer, setReferer] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post("/api/analyze", { url, referer });
      onResponse(response.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="text" placeholder="Enter URL" value={url} onChange={(e) => setUrl(e.target.value)} required />
      <input type="text" placeholder="Enter Referer (optional)" value={referer} onChange={(e) => setReferer(e.target.value)} />
      <button type="submit">Analyze</button>
    </form>
  );
}
