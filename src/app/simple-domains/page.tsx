"use client";

import React, { useState, useEffect } from "react";
import { fetchDomains } from "../../lib/cloudflare-api";

// Simplified domain interface
interface CloudflareDomain {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  created_on: string;
  modified_on: string;
}

export default function SimpleDomainPage() {
  const [domains, setDomains] = useState<CloudflareDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadDomains() {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log("Fetching domains from zone-management endpoint...");
        const result = await fetchDomains(1, 25);
        
        if (result.success) {
          setDomains(result.domains || []);
          console.log("API test successful:", result);
        } else {
          throw new Error(result.error || "Unknown error");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        console.error("Error loading domains:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadDomains();
  }, []);

  // Format date from Cloudflare timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get domain status class
  const getStatusClass = (status: string, paused: boolean) => {
    if (paused) return "bg-red-100 text-red-700";
    
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "active": return "bg-green-100 text-green-700";
      case "pending": return "bg-yellow-100 text-yellow-700";
      case "inactive": return "bg-gray-100 text-gray-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Cloudflare Domains</h1>
      <p className="mb-6 text-gray-600">Using the fixed zone-management API endpoint</p>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-32 bg-gray-50 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="ml-3">Loading domains...</p>
        </div>
      ) : error ? (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">Found {domains.length} domains</p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created On
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified On
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {domains.map((domain) => (
                  <tr key={domain.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {domain.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(domain.status, domain.paused)}`}>
                        {domain.paused ? "Paused" : domain.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(domain.created_on)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(domain.modified_on)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {domains.length === 0 && (
            <div className="text-center p-10 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No domains found</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}