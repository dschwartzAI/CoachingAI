import { NextResponse } from 'next/server';
import { createServerClientWithCookies } from '@/lib/utils/supabaseServer';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { title, hasCustomTitle } = await request.json();
    
    // Validate input
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    // Get supabase client
    const supabase = await createServerClientWithCookies();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Update the thread title
    const { data, error } = await supabase
      .from('threads')
      .update({ 
        title: title.trim(),
        has_custom_title: hasCustomTitle || true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns the thread
      .select()
      .single();
    
    if (error) {
      console.error('Error updating thread title:', error);
      return NextResponse.json(
        { error: 'Failed to update chat title' },
        { status: 500 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Chat not found or unauthorized' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        title: data.title,
        has_custom_title: data.has_custom_title
      }
    });
  } catch (error) {
    console.error('Chat PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // Get supabase client
    const supabase = await createServerClientWithCookies();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the thread
    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data 
    });
  } catch (error) {
    console.error('Chat GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 