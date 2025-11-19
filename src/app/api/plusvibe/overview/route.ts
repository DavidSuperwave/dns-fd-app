import { NextResponse } from "next/server";
import { getOverviewSnapshot, PlusVibeAPIError } from "@/lib/plusvibe";

export async function GET() {
  try {
    const snapshot = await getOverviewSnapshot({
      campaignId: process.env.PLUSVIBE_DEFAULT_CAMPAIGN_ID || null,
    });

    return NextResponse.json({
      success: true,
      metrics: snapshot.metrics,
      campaigns: snapshot.campaigns,
    });
  } catch (error) {
    const status = error instanceof PlusVibeAPIError ? error.status : 500;
    const message =
      error instanceof PlusVibeAPIError ? error.message : "Failed to load PlusVibe overview metrics";

    console.error("[PlusVibe] overview route error", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

