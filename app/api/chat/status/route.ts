import { NextResponse } from 'next/server';

export async function GET() {
  // For now, always return online status
  // In production, this could check actual admin availability
  return NextResponse.json({ online: true });
}
