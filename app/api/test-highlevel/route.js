"use server"

import { NextResponse } from 'next/server';
import { getDCMTemplateData, getDCMPageTemplates } from '@/lib/utils/highlevel-api';

export async function GET(request) {
  try {
    console.log('[HighLevel Test] Testing HighLevel API integration...');
    
    // Test basic API connectivity
    const templateData = await getDCMTemplateData();
    const pageTemplates = await getDCMPageTemplates();
    
    const testResults = {
      success: true,
      timestamp: new Date().toISOString(),
      results: {
        templateData: {
          available: !!templateData,
          workflowCount: templateData?.workflows ? Object.keys(templateData.workflows).length : 0,
          funnelCount: templateData?.funnels ? templateData.funnels.length : 0,
          campaignCount: templateData?.campaigns ? templateData.campaigns.length : 0
        },
        pageTemplates: {
          available: !!pageTemplates,
          templateCount: pageTemplates ? Object.keys(pageTemplates).length : 0,
          templateTypes: pageTemplates ? Object.keys(pageTemplates) : []
        }
      },
      config: {
        baseUrl: process.env.HIGHLEVEL_API_TOKEN ? 'Token configured ✓' : 'Token missing ✗',
        locationId: process.env.HIGHLEVEL_LOCATION_ID ? 'Location ID configured ✓' : 'Location ID missing ✗'
      }
    };
    
    console.log('[HighLevel Test] Test completed successfully');
    return NextResponse.json(testResults);
    
  } catch (error) {
    console.error('[HighLevel Test] Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      config: {
        baseUrl: process.env.HIGHLEVEL_API_TOKEN ? 'Token configured ✓' : 'Token missing ✗',
        locationId: process.env.HIGHLEVEL_LOCATION_ID ? 'Location ID configured ✓' : 'Location ID missing ✗'
      }
    }, { status: 500 });
  }
} 