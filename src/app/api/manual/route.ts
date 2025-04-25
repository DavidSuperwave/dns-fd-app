import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const gitBookURL = 'https://superwave.gitbook.io/manual/'; // Define outside try block

  try {
    // Get the origin for favicon path
    const origin = request.headers.get('origin') || request.nextUrl.origin;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Superwave User's Manual</title>
          <link rel="icon" type="image/png" href="${origin}/favicon.png">
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui;
              background: #f8f9fa;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              color: #4e1ddc;
            }
            .loader {
              width: 40px;
              height: 40px;
              border: 3px solid #4e1ddc;
              border-bottom-color: transparent;
              border-radius: 50%;
              margin-bottom: 16px;
              animation: rotation 1s linear infinite;
            }
            @keyframes rotation {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <script>
            // Wait for everything to load
            window.onload = () => {
              // Show our branding for a moment
              setTimeout(() => {
                // Open GitBook in the same window
                window.location.replace('${gitBookURL}');
              }, 800);
            };
          </script>
        </head>
        <body>
          <div class="loader"></div>
          <div>Opening Superwave Manual...</div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error serving manual:', error);
    return NextResponse.redirect(gitBookURL);
  }
}