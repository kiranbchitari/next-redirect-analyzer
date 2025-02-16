import type { RedirectResponse } from "@/shared/schema";

export default function RedirectChain({ response }: { response: RedirectResponse }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Redirect Chain</h2>
      <ul className="border rounded-lg p-4 bg-gray-100">
        {response.redirectChain.map((step, index) => (
          <li key={index} className="mb-2">
            <p>
              <strong>Step {index + 1}:</strong>{" "}
              <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                {step.url}
              </a>
            </p>
            <p>Status Code: <span className="font-mono">{step.statusCode}</span></p>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold mt-4">Final Destination</h2>
      <p>
        <a href={response.finalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
          {response.finalUrl}
        </a>
      </p>
      <p>Status Code: <span className="font-mono">{response.finalStatusCode}</span></p>
    </div>
  );
}
