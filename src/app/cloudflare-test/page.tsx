"use client";

import { useState, useEffect } from "react";
import { fetchDomains } from "@/lib/cloudflare-api";

// Define an interface for the expected domain structure from Cloudflare API
interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  created_on: string;
  // Add other relevant fields if needed
}

export default function CloudflareTestPage() {
  const [domains, setDomains] = useState<CloudflareDomain[]>([]); // Use CloudflareDomain interface
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiResponseDetails, setApiResponseDetails] = useState<string>("");

  useEffect(() => {
    async function testApi() {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log("Fetching domains from zone-management endpoint...");
        const result = await fetchDomains(1, 10);
        
        // Store the full API response for debugging
        setApiResponseDetails(JSON.stringify(result, null, 2));
        
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
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cloudflare API Test</h1>
      <p className="mb-4 text-gray-600">Testing the zone-management API endpoint</p>
      
      {isLoading && (
        <div className="p-4 mb-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-600">Loading domains from API...</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {!isLoading && !error && domains.length === 0 && (
        <div className="p-4 mb-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-700">No domains found in the API response</p>
        </div>
      )}
      
      {domains.length > 0 && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold mb-4">Domains Found: {domains.length}</h2>
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created On</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {domains.map((domain: CloudflareDomain) => ( // Use CloudflareDomain interface
                  <tr key={domain.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{domain.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${domain.status === 'active' ? 'bg-green-100 text-green-800' : 
                        domain.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                        {domain.status}
                        {domain.paused && " (paused)"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(domain.created_on).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-3">API Response Details</h2>
        <pre className="bg-gray-800 text-gray-200 p-4 rounded-lg overflow-auto max-h-96">
          {apiResponseDetails || "No response details available"}
        </pre>
      </div>
    </div>
  );
}