"use server"

// HighLevel Documentation and Template Reference System for DCM Tool
// This integrates with James's DCM 2.0 templates to provide proven copy structures
import { getDCMTemplateData, getDCMPageTemplates } from './highlevel-api.js';

// HighLevel Setup Documentation
export const HIGHLEVEL_SETUP_DOCS = {
  // GoHighLevel Account Setup
  accountSetup: {
    title: "GoHighLevel Account Setup",
    steps: [
      "1. Log into your GoHighLevel account at app.gohighlevel.com",
      "2. Navigate to Sites → Funnels",
      "3. Click 'Import Funnel' or 'Clone Template'",
      "4. Search for 'DCM 2.0 Templates' or use the template ID",
      "5. Import the complete DCM 2.0 funnel system"
    ],
    troubleshooting: [
      "If template not found: Contact support for DCM 2.0 Templates access",
      "Import errors: Check your account permissions and subscription level",
      "Missing pages: Ensure you're importing the complete funnel, not individual pages"
    ]
  },

  // Page Customization Guide
  pageCustomization: {
    title: "DCM Page Customization Guide",
    pages: {
      "opt-in": {
        name: "Opt-in/Lead Magnet Page",
        elements: ["Headline", "Subheadline", "Lead magnet description", "Email form", "Privacy policy link"],
        tips: [
          "Keep headline under 10 words",
          "Focus on ONE specific benefit",
          "Use social proof if available",
          "Make the form above the fold"
        ]
      },
      "frontend-sales": {
        name: "Front-end Sales Page ($27-47)",
        elements: ["Headline", "Problem section", "Solution presentation", "Price & offer", "Guarantee", "Order form"],
        tips: [
          "Address the specific problem from your opt-in",
          "Show the transformation clearly",
          "Use urgency/scarcity ethically",
          "Include testimonials if available"
        ]
      },
      "order-bump": {
        name: "Order Bump ($17-37)",
        elements: ["Compelling offer", "Clear value proposition", "Simple checkbox", "Pricing"],
        tips: [
          "Complement the main offer",
          "Make it feel like a no-brainer",
          "Use 'Yes/No' language",
          "Price at 30-70% of main offer"
        ]
      },
      "upsell": {
        name: "Upsell Page ($197-497)",
        elements: ["Congratulations message", "Next level offer", "Urgency element", "Accept/Decline buttons"],
        tips: [
          "Acknowledge their smart purchase",
          "Present as logical next step",
          "Time-sensitive bonus",
          "Clear yes/no options"
        ]
      },
      "thank-you": {
        name: "Thank You/Delivery Page",
        elements: ["Confirmation message", "Access instructions", "What's next", "Social sharing"],
        tips: [
          "Set clear expectations",
          "Provide immediate value",
          "Encourage engagement",
          "Hint at future opportunities"
        ]
      },
      "membership-sales": {
        name: "Membership Sales Page ($47-97/month)",
        elements: ["Community benefits", "Monthly value", "Success stories", "Join button"],
        tips: [
          "Focus on ongoing support",
          "Show community activity",
          "Highlight exclusive content",
          "Use monthly pricing psychology"
        ]
      },
      "high-ticket-application": {
        name: "High-Ticket Application Page",
        elements: ["Qualification questions", "Calendar booking", "Application form", "Expectations"],
        tips: [
          "Pre-qualify serious prospects",
          "Set high standards",
          "Use application psychology",
          "Book strategy calls, not sales calls"
        ]
      },
      "vsl-page": {
        name: "Video Sales Letter Page",
        elements: ["Video player", "Call-to-action", "Testimonials", "FAQ section"],
        tips: [
          "Auto-play video",
          "Hide/show CTA after video",
          "Use social proof strategically",
          "Address common objections"
        ]
      }
    }
  },

  // Technical Setup
  technicalSetup: {
    title: "Technical Configuration",
    domains: {
      steps: [
        "1. Go to Settings → Domains",
        "2. Add your custom domain",
        "3. Update DNS records with your registrar",
        "4. Verify domain connection",
        "5. Set up SSL certificate"
      ]
    },
    payments: {
      steps: [
        "1. Navigate to Payments → Payment Integrations",
        "2. Connect Stripe account",
        "3. Configure tax settings",
        "4. Set up webhooks for order processing",
        "5. Test payment flow with small amount"
      ]
    },
    emailIntegration: {
      steps: [
        "1. Go to Settings → Email Services",
        "2. Connect your email provider (Mailgun, SendGrid, etc.)",
        "3. Verify sending domain",
        "4. Set up DKIM and SPF records",
        "5. Test email delivery"
      ]
    }
  },

  // Common Issues & Solutions
  troubleshooting: {
    title: "Common Issues & Solutions",
    issues: [
      {
        problem: "Pages not loading properly",
        solutions: [
          "Check domain DNS settings",
          "Verify SSL certificate",
          "Clear browser cache",
          "Check HighLevel status page"
        ]
      },
      {
        problem: "Payment processing errors",
        solutions: [
          "Verify Stripe connection",
          "Check webhook URLs",
          "Confirm tax settings",
          "Test with different payment method"
        ]
      },
      {
        problem: "Email delivery issues",
        solutions: [
          "Check email service integration",
          "Verify DNS records",
          "Review spam score",
          "Test with different email providers"
        ]
      },
      {
        problem: "Funnel tracking not working",
        solutions: [
          "Verify Google Analytics setup",
          "Check Facebook Pixel installation",
          "Confirm conversion tracking",
          "Test with HighLevel's built-in analytics"
        ]
      }
    ]
  }
};

// DCM Best Practices from James's Knowledge Base
export const DCM_BEST_PRACTICES = {
  copywriting: {
    headlines: [
      "Use numbers and specificity",
      "Address the exact problem",
      "Promise a clear outcome",
      "Create curiosity gap"
    ],
    offers: [
      "Stack value higher than price",
      "Use urgency ethically",
      "Provide clear guarantees",
      "Show social proof"
    ],
    emails: [
      "Subject lines under 50 characters",
      "Personal, conversational tone",
      "One clear call-to-action",
      "Story-driven content"
    ]
  },
  strategy: {
    pricing: [
      "Front-end: $27-47 sweet spot",
      "Order bump: 30-70% of main offer",
      "Upsell: 4-10x front-end price",
      "Membership: $47-97/month"
    ],
    funnel: [
      "Optimize for email capture first",
      "Focus on one traffic source initially",
      "Test headlines before traffic",
      "Scale what's working"
    ]
  }
};

// Function to get James's DCM knowledge from vector store + HighLevel templates
export async function getJamesDCMTemplatesForReference(userAnswers = {}, requestType = 'general') {
  try {
    console.log('[DCM Templates] Fetching James\'s DCM knowledge from vector store...');
    
    // Query vector store for relevant DCM knowledge based on request type
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const searchQuery = `Daily Client Machine ${requestType} ${Object.values(userAnswers).join(' ')}`;
    const vectorResults = await openai.beta.vectorStores.files.list(
      process.env.OPENAI_VECTOR_STORE_ID || "vs_67df294659c48191bffbe978d27fc6f7",
      { limit: 5 }
    );
    
    // Get HighLevel templates in parallel
    const [templateData, pageTemplates] = await Promise.all([
      getDCMTemplateData().catch(() => null),
      getDCMPageTemplates().catch(() => null)
    ]);

    return {
      vectorKnowledge: vectorResults?.data || [],
      jamesTemplates: { live: templateData, pages: pageTemplates },
      setupGuidance: HIGHLEVEL_SETUP_DOCS,
      lastUpdated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[DCM Templates] Vector store access failed:', error);
    return { vectorKnowledge: [], jamesTemplates: { live: null, pages: null }, setupGuidance: HIGHLEVEL_SETUP_DOCS };
  }
}

// Function to enhance DCM prompts with James's vector store knowledge + templates
export async function enhanceDCMPromptWithJamesTemplates(basePrompt, userAnswers, requestType = 'general') {
  try {
    const data = await getJamesDCMTemplatesForReference(userAnswers, requestType);
    
    return basePrompt + `\n\n## JAMES'S DCM KNOWLEDGE BASE ACCESS:
**Vector Store Files Available:** ${data.vectorKnowledge.length} DCM knowledge files
**Live Templates:** ${data.jamesTemplates.live ? 'Connected' : 'Unavailable'}
**Page Templates:** ${data.jamesTemplates.pages ? 'Available' : 'Unavailable'}

**CRITICAL:** Access James's complete DCM knowledge base to provide expert-level guidance. Reference specific strategies, case studies, and proven frameworks from the knowledge base.`;
    
  } catch (error) {
    console.error('[DCM Templates] Vector store enhancement failed:', error);
    return basePrompt + '\n\n(Note: James\'s knowledge base temporarily unavailable)';
  }
}

// Note: HIGHLEVEL_SETUP_DOCS and DCM_BEST_PRACTICES are already exported above with their declarations 