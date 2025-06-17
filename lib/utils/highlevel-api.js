"use server"

const HIGHLEVEL_CONFIG = {
  baseUrl: "https://services.leadconnectorhq.com",
  apiToken: process.env.HIGHLEVEL_API_TOKEN || "pit-89f58c54-14b9-4b46-9f16-206db3faa3b7",
  locationId: process.env.HIGHLEVEL_LOCATION_ID || "4BO06AvPiDJEeqf2WhmU",
  version: "2021-07-28"
};

// DCM 2.0 Workflow IDs from James Kemp's account
const DCM_WORKFLOW_IDS = {
  mainFunnel: "ad102e7b-7078-47cd-8910-8fceaa7bca41",
  reminderEmail: "d48d8f2b-428d-4e78-8214-36c2c60ce2ec", 
  workshop: "61ffd0c3-b0f3-462f-979d-fc7bffb61663",
  bundleUpsell: "c95f91ac-c3d0-42c7-ba41-a8010d06e78b",
  cashCampaign: "8db061a1-8d4f-4c07-8006-56047e48a957"
};

class HighLevelAPI {
  constructor() {
    this.headers = {
      "Authorization": `Bearer ${HIGHLEVEL_CONFIG.apiToken}`,
      "Version": HIGHLEVEL_CONFIG.version,
      "Content-Type": "application/json"
    };
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const url = new URL(endpoint, HIGHLEVEL_CONFIG.baseUrl);
      
      // Add location ID to params if not already present
      if (!params.locationId) {
        params.locationId = HIGHLEVEL_CONFIG.locationId;
      }
      
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });

      console.log(`[HighLevel API] Making request to: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        headers: this.headers,
        method: 'GET'
      });

      if (!response.ok) {
        console.error(`[HighLevel API] HTTP ${response.status}: ${response.statusText}`);
        throw new Error(`HighLevel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[HighLevel API] Response received with ${JSON.stringify(data).length} characters`);
      
      return data;
    } catch (error) {
      console.error(`[HighLevel API] Request failed:`, error);
      throw error;
    }
  }

  // Get all workflows from the account
  async getWorkflows() {
    return await this.makeRequest('/workflows/');
  }

  // Get specific DCM 2.0 workflows
  async getDCMWorkflows() {
    try {
      const allWorkflows = await this.getWorkflows();
      
      const dcmWorkflows = {};
      
      // Filter for DCM-related workflows
      if (allWorkflows.workflows) {
        allWorkflows.workflows.forEach(workflow => {
          Object.keys(DCM_WORKFLOW_IDS).forEach(key => {
            if (workflow.id === DCM_WORKFLOW_IDS[key]) {
              dcmWorkflows[key] = workflow;
            }
          });
        });
      }
      
      console.log(`[HighLevel API] Found ${Object.keys(dcmWorkflows).length} DCM workflows`);
      return dcmWorkflows;
    } catch (error) {
      console.error('[HighLevel API] Failed to get DCM workflows:', error);
      return {};
    }
  }

  // Get funnel pages and templates
  async getFunnels() {
    return await this.makeRequest('/funnels/funnel/list');
  }

  // Get campaigns
  async getCampaigns() {
    return await this.makeRequest('/campaigns/');
  }

  // Extract DCM funnel structure and content
  async getDCMFunnelData() {
    try {
      console.log('[HighLevel API] Fetching DCM funnel data...');
      
      const [workflows, funnels, campaigns] = await Promise.all([
        this.getDCMWorkflows(),
        this.getFunnels(),
        this.getCampaigns()
      ]);

      // Process and structure the data for DCM generation
      const dcmData = {
        workflows,
        funnels: this.filterDCMFunnels(funnels),
        campaigns: this.filterDCMCampaigns(campaigns),
        lastUpdated: new Date().toISOString()
      };

      console.log('[HighLevel API] DCM funnel data compiled successfully');
      return dcmData;
      
    } catch (error) {
      console.error('[HighLevel API] Failed to get DCM funnel data:', error);
      return null;
    }
  }

  // Filter funnels for DCM-related content
  filterDCMFunnels(funnels) {
    if (!funnels || !funnels.funnels) return [];
    
    return funnels.funnels.filter(funnel => 
      funnel.name && (
        funnel.name.toLowerCase().includes('dcm') ||
        funnel.name.toLowerCase().includes('daily client machine') ||
        funnel.name.toLowerCase().includes('client machine')
      )
    );
  }

  // Filter campaigns for DCM content
  filterDCMCampaigns(campaigns) {
    if (!campaigns || !campaigns.campaigns) return [];
    
    return campaigns.campaigns.filter(campaign =>
      campaign.name && (
        campaign.name.toLowerCase().includes('dcm') ||
        campaign.name.toLowerCase().includes('daily client') ||
        campaign.name.toLowerCase().includes('client machine')
      )
    );
  }

  // Extract page templates and copy from DCM funnels
  async extractDCMPageTemplates() {
    try {
      const dcmData = await this.getDCMFunnelData();
      
      if (!dcmData || !dcmData.funnels || dcmData.funnels.length === 0) {
        console.log('[HighLevel API] No DCM funnels found, using default templates');
        return null;
      }

      const pageTemplates = {};
      
      // Process each DCM funnel to extract page structures
      dcmData.funnels.forEach(funnel => {
        if (funnel.pages) {
          funnel.pages.forEach(page => {
            const pageType = this.identifyPageType(page);
            if (pageType) {
              pageTemplates[pageType] = {
                name: page.name,
                url: page.url,
                content: page.content || '',
                settings: page.settings || {},
                funnel: funnel.name
              };
            }
          });
        }
      });

      console.log('[HighLevel API] Extracted page templates:', Object.keys(pageTemplates));
      return pageTemplates;
      
    } catch (error) {
      console.error('[HighLevel API] Failed to extract page templates:', error);
      return null;
    }
  }

  // Identify page type based on name and content
  identifyPageType(page) {
    const name = page.name ? page.name.toLowerCase() : '';
    
    if (name.includes('opt') || name.includes('squeeze') || name.includes('lead')) {
      return 'optIn';
    }
    if (name.includes('sales') || name.includes('vsl') || name.includes('video')) {
      return 'salesPage';
    }
    if (name.includes('order') || name.includes('checkout')) {
      return 'orderForm';
    }
    if (name.includes('bump')) {
      return 'orderBump';
    }
    if (name.includes('upsell') || name.includes('oto')) {
      return 'upsell';
    }
    if (name.includes('thank') || name.includes('confirmation')) {
      return 'thankYou';
    }
    if (name.includes('member') || name.includes('trial')) {
      return 'membershipOffer';
    }
    if (name.includes('deliver') || name.includes('access')) {
      return 'deliveryPage';
    }
    
    return null;
  }
}

// Export functions for use in the chat API
export async function getDCMTemplateData() {
  const api = new HighLevelAPI();
  return await api.getDCMFunnelData();
}

export async function getDCMPageTemplates() {
  const api = new HighLevelAPI();
  return await api.extractDCMPageTemplates();
}

export async function enhanceDCMPromptWithTemplates(basePrompt, userAnswers) {
  try {
    console.log('[HighLevel API] Enhancing DCM prompt with templates...');
    
    const [templateData, pageTemplates] = await Promise.all([
      getDCMTemplateData(),
      getDCMPageTemplates()
    ]);

    if (!templateData && !pageTemplates) {
      console.log('[HighLevel API] No template data available, using base prompt');
      return basePrompt;
    }

    // Enhance the prompt with real template data
    let enhancedPrompt = basePrompt;
    
    if (pageTemplates && Object.keys(pageTemplates).length > 0) {
      enhancedPrompt += `\n\n## REAL DCM 2.0 TEMPLATE REFERENCE\n\nYou have access to actual DCM 2.0 funnel templates from James Kemp's proven funnels. Use these as design standards and copy inspiration:\n\n`;
      
      Object.keys(pageTemplates).forEach(pageType => {
        const template = pageTemplates[pageType];
        enhancedPrompt += `### ${pageType.toUpperCase()} Template (from "${template.funnel}"):\n`;
        enhancedPrompt += `- Page Name: ${template.name}\n`;
        if (template.content) {
          enhancedPrompt += `- Content Preview: ${template.content.substring(0, 200)}...\n`;
        }
        enhancedPrompt += `\n`;
      });
    }

    if (templateData && templateData.workflows && Object.keys(templateData.workflows).length > 0) {
      enhancedPrompt += `### DCM Workflows Available:\n`;
      Object.keys(templateData.workflows).forEach(workflowKey => {
        const workflow = templateData.workflows[workflowKey];
        enhancedPrompt += `- ${workflowKey}: ${workflow.name}\n`;
      });
      enhancedPrompt += `\n`;
    }

    enhancedPrompt += `\nIMPORTANT: Use these real templates as inspiration for structure, flow, and proven copy elements. Adapt them to the user's specific answers while maintaining the proven DCM 2.0 framework.\n`;

    console.log('[HighLevel API] Enhanced prompt with template data');
    return enhancedPrompt;
    
  } catch (error) {
    console.error('[HighLevel API] Failed to enhance prompt with templates:', error);
    return basePrompt;
  }
}

export default HighLevelAPI; 