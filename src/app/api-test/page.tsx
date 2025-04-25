"use client";

import { useState, useEffect } from "react";
import { fetchDomains } from "@/lib/cloudflare-api";

// Define an interface for the expected domain structure
interface Domain {
  id: string;
  name: string;
  status: string;
  // Add other relevant fields if needed
}

export default function ApiTestPage() {
  const [domains, setDomains] = useState<Domain[]>([]); // Use the Domain interface
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testApi() {
      try {
        setIsLoading(true);
        setError(null);
        
        const result = await fetchDomains(1, 10);
        
        if (result.success) {
          setDomains(result.domains || []);
          console.log("API test successful:", result);
        } else {
          setError(result.error || "Unknown error");
          console.error("API test failed:", result.error);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("API test error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    testApi();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      <p className="mb-4">Testing the zone-management API endpoint</p>
      
      {isLoading && <p className="text-blue-600">Loading...</p>}
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-400 rounded">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}
      
      {!isLoading && !error && domains.length === 0 && (
        <p className="text-amber-600">No domains found</p>
      )}
      
      {domains.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Domains:</h2>
          <ul className="list-disc pl-5">
            {domains.map((domain: Domain) => ( // Use the Domain interface
              <li key={domain.id} className="mb-1">
                {domain.name} - {domain.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}