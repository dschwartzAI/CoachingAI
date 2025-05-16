"use server";

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const requestData = await req.json();
    const { threadId, metadata } = requestData;
    
    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }
    
    // Initialize Supabase client
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get session to verify authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Update the thread metadata
    const { data, error } = await supabase
      .from('threads')
      .update({ 
        metadata: metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .eq('user_id', session.user.id) // Ensure the user owns this thread
      .select('id, metadata');
    
    if (error) {
      console.error('Error updating thread metadata:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Thread not found or access denied' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: data[0]
    });
    
  } catch (error) {
    console.error('Unexpected error in update-thread-metadata:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 