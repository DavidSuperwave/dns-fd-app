import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Inserting domain into Supabase:', body);

    if (!supabaseAdmin) {
      console.error('Supabase client is not initialized.');
      return NextResponse.json({ error: 'Supabase client is not initialized.' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('domains')
      .insert({
        cloudflare_id: body.cloudflare_id,
        name: body.name,
        status: body.status,
        paused: body.paused,
        type: body.type,
        created_on: body.created_on,
        modified_on: body.modified_on,
        last_synced: body.last_synced,
        redirect_url: body.redirect_url
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting domain:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Successfully inserted domain:', data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in POST /api/supabase/domains:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}