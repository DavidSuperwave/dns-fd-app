"use client";

import { useEffect } from 'react';
export default function ManualPage() {

  useEffect(() => {
    // Set up iframe to display GitBook content
    const iframe = document.createElement('iframe');
    iframe.src = 'https://superwave.gitbook.io/manual/';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    // Clear the current page content and add the iframe
    document.body.innerHTML = '';
    document.body.appendChild(iframe);
  }, []); // No dependencies needed since we're only running this once on mount

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Opening Manual...</h1>
        <p className="text-muted-foreground">
          If nothing happens,{' '}
          <a 
            href="https://superwave.gitbook.io/manual/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#4e1ddc] hover:underline"
          >
            open in new tab
          </a>
        </p>
      </div>
    </div>
  );
}