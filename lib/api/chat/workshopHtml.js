async function generateWorkshopHTML(collectedAnswers) {
  // Check if there are design modifications requested
  const hasDesignInstructions = collectedAnswers._designInstructions;
  const designTheme = collectedAnswers._designTheme;
  
  // Enhanced prompt for design modifications
  let designGuidelines = "";
  if (hasDesignInstructions) {
    designGuidelines = `\n\nSPECIAL DESIGN INSTRUCTIONS:
The user has requested the following design changes: "${collectedAnswers._designInstructions}"

Please incorporate these changes into the design. Common modifications:
- Color changes: Update CSS color schemes, gradients, and backgrounds
- Layout changes: Modify spacing, positioning, and structure
- Style changes: Adjust fonts, sizes, borders, shadows
- Theme changes: Make it more professional/modern/bold as requested
- Text changes: Update copy while maintaining conversion focus

Apply the requested changes while maintaining:
- Professional appearance
- Mobile responsiveness  
- Conversion optimization
- Accessibility standards`;
  }

  if (designTheme) {
    designGuidelines += `\n\nDESIGN THEME: ${designTheme.toUpperCase()}
- Professional: Clean, corporate colors (navy, gray, white), minimal design
- Modern: Contemporary gradients, sleek fonts, subtle animations
- Bold: Vibrant colors, strong contrasts, impactful typography`;
  }

  // Use Claude Opus to create compelling copy from the collected answers
  const copyGenerationPrompt = `You are an expert direct-response copywriter specializing in high-converting workshop landing pages. You follow the proven principles of copywriting legends like David Ogilvy, Gary Halbert, and Dan Kennedy.

Workshop Information:
- Participant Outcomes: ${collectedAnswers.participantOutcomes || 'Transform skills and achieve results'}
- Target Audience: ${collectedAnswers.targetAudience || 'professionals and entrepreneurs'}
- Problem Addressed: ${collectedAnswers.problemAddressed || 'common challenges'}
- Workshop Duration: ${collectedAnswers.workshopDuration || 'intensive workshop'}
- Topics and Activities: ${collectedAnswers.topicsAndActivities || 'proven strategies'}
- Resources Provided: ${collectedAnswers.resourcesProvided || 'comprehensive materials'}${designGuidelines}

Create compelling, conversion-focused copy for each section. Use these copywriting best practices:

HEADLINE BEST PRACTICES:
- Lead with the biggest benefit or transformation
- Use specific numbers and timeframes when possible
- Create urgency or curiosity
- Address the target audience directly
- Keep under 60 characters for main headlines

BENEFIT WRITING:
- Focus on outcomes, not features
- Use "you will" language
- Be specific and measurable
- Address pain points directly
- Create emotional connection

CTA BEST PRACTICES:
- Use action-oriented language
- Create urgency
- Remove friction
- Be specific about what happens next

Return your response as valid JSON with this exact structure:
{
  "pageTitle": "SEO-optimized page title (60 chars max)",
  "headerSubtitle": "Target audience qualifier (e.g., 'For Small Business Owners:')",
  "heroHeadline": "Compelling main headline (60 chars max)",
  "heroSubheadline": "Supporting headline with benefit/proof (100 chars max)",
  "benefitsList": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "presenterName": "Workshop Expert",
  "formTitle": "Registration form title",
  "ctaHighlight": "CTA button highlight text",
  "ctaDescription": "CTA description text",
  "emailPlaceholder": "Email input placeholder",
  "ctaButtonText": "Button text",
  "formSubtitle": "Form subtitle with urgency",
  "guaranteeTitle": "Guarantee headline",
  "guaranteeText": "Guarantee description",
  "faqItems": [
    {"question": "FAQ question 1", "answer": "FAQ answer 1"},
    {"question": "FAQ question 2", "answer": "FAQ answer 2"},
    {"question": "FAQ question 3", "answer": "FAQ answer 3"}
  ],
  "footerCopyright": "Copyright text",
  "footerDisclaimer": "Disclaimer text"
}

Guidelines:
- Use James Kemp's direct, no-fluff style
- Focus on specific outcomes and transformations
- Create urgency and scarcity where appropriate
- Make every word count for conversions
- Use power words and emotional triggers
- Ensure all copy is compelling and professional
- Transform the user's input into benefit-focused, conversion copy${hasDesignInstructions ? '\n- Apply the requested design changes to the overall styling and presentation' : ''}`;

  try {
    console.log('[CHAT_API_DEBUG] Generating AI-powered workshop copy with Claude Opus');
    
    const message = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      temperature: 0.8,
      messages: [
        {
          role: "user",
          content: copyGenerationPrompt
        }
      ]
    });

    const copyDataString = message.content[0].text;
    console.log('[CHAT_API_DEBUG] Claude Opus raw response:', copyDataString);
    
    // Extract JSON from the response (Claude might include extra text)
    let jsonMatch = copyDataString.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    
    const copyData = JSON.parse(jsonMatch[0]);
    console.log('[CHAT_API_DEBUG] Claude-generated copy data:', copyData);

    // Determine color scheme and styling based on design instructions
    let colorScheme = {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#ff6b6b',
      accentSecondary: '#ee5a24',
      success: '#10b981',
      successSecondary: '#059669',
      warning: '#f59e0b',
      warningSecondary: '#d97706',
      dark: '#1f2937',
      light: '#f8fafc',
      lightSecondary: '#e2e8f0'
    };

    // Apply design theme modifications
    if (designTheme === 'professional') {
      colorScheme = {
        primary: '#1e3a8a',
        secondary: '#3730a3',
        accent: '#059669',
        accentSecondary: '#047857',
        success: '#10b981',
        successSecondary: '#059669',
        warning: '#d97706',
        warningSecondary: '#b45309',
        dark: '#1f2937',
        light: '#f8fafc',
        lightSecondary: '#e2e8f0'
      };
    } else if (designTheme === 'modern') {
      colorScheme = {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        accentSecondary: '#0891b2',
        success: '#10b981',
        successSecondary: '#059669',
        warning: '#f59e0b',
        warningSecondary: '#d97706',
        dark: '#0f172a',
        light: '#f1f5f9',
        lightSecondary: '#e2e8f0'
      };
    } else if (designTheme === 'bold') {
      colorScheme = {
        primary: '#dc2626',
        secondary: '#b91c1c',
        accent: '#ea580c',
        accentSecondary: '#c2410c',
        success: '#16a34a',
        successSecondary: '#15803d',
        warning: '#ca8a04',
        warningSecondary: '#a16207',
        dark: '#1c1917',
        light: '#fafaf9',
        lightSecondary: '#f5f5f4'
      };
    }

    // Apply specific color modifications based on user instructions
    if (hasDesignInstructions) {
      const instructions = collectedAnswers._designInstructions.toLowerCase();
      
      if (instructions.includes('blue')) {
        colorScheme.primary = '#2563eb';
        colorScheme.secondary = '#1d4ed8';
      }
      if (instructions.includes('green')) {
        colorScheme.primary = '#059669';
        colorScheme.secondary = '#047857';
      }
      if (instructions.includes('purple')) {
        colorScheme.primary = '#7c3aed';
        colorScheme.secondary = '#6d28d9';
      }
      if (instructions.includes('red')) {
        colorScheme.primary = '#dc2626';
        colorScheme.secondary = '#b91c1c';
      }
      if (instructions.includes('dark')) {
        colorScheme.light = '#374151';
        colorScheme.lightSecondary = '#4b5563';
        colorScheme.dark = '#111827';
      }
    }

    // Base HTML template (Modern, Bold, Professional Style)
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PAGE_TITLE}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Header */
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 20px 0;
            text-align: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-subtitle {
            color: ${colorScheme.primary};
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            padding: 80px 0;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.3;
        }
        
        .hero-content {
            position: relative;
            z-index: 2;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            font-weight: 900;
            margin-bottom: 24px;
            line-height: 1.1;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hero .subheadline {
            font-size: 1.4rem;
            margin-bottom: 40px;
            font-weight: 500;
            opacity: 0.95;
            max-width: 700px;
            margin-left: auto;
            margin-right: auto;
            text-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
            color: white;
            padding: 20px 50px;
            font-size: 1.2rem;
            font-weight: 700;
            text-decoration: none;
            border-radius: 50px;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(255, 107, 107, 0.4);
            border: none;
            cursor: pointer;
        }
        
        .cta-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(255, 107, 107, 0.6);
        }
        
        /* What You'll Learn Section */
        .benefits {
            padding: 80px 0;
            background: white;
            position: relative;
        }
        
        .benefits::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 100px;
            background: linear-gradient(180deg, ${colorScheme.primary} 0%, transparent 100%);
        }
        
        .benefits-content {
            position: relative;
            z-index: 2;
        }
        
        .benefits h2 {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 60px;
            color: #1a1a1a;
            position: relative;
        }
        
        .benefits h2::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
            border-radius: 2px;
        }
        
        .benefits-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            max-width: 1000px;
            margin: 0 auto;
        }
        
        .benefit-item {
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            padding: 30px;
            border-radius: 20px;
            border-left: 6px solid ${colorScheme.primary};
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        
        .benefit-item::before {
            content: '✓';
            position: absolute;
            top: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${colorScheme.success} 0%, ${colorScheme.successSecondary} 100%);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
        }
        
        .benefit-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        
        .benefit-text {
            font-size: 1.1rem;
            font-weight: 500;
            color: #374151;
            line-height: 1.6;
            padding-right: 60px;
        }
        
        /* Presenter Section */
        .presenter {
            padding: 60px 0;
            background: linear-gradient(135deg, ${colorScheme.secondary} 0%, ${colorScheme.primary} 100%);
            text-align: center;
            color: white;
        }
        
        .presenter h3 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 20px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .presenter-subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
            font-weight: 500;
        }
        
        /* Form Section */
        .form-section {
            padding: 80px 0;
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            text-align: center;
            position: relative;
        }
        
        .form-section h3 {
            font-size: 2.2rem;
            font-weight: 800;
            margin-bottom: 40px;
            color: #1a1a1a;
        }
        
        .form-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 50px;
            border-radius: 30px;
            box-shadow: 0 30px 60px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            position: relative;
            overflow: hidden;
        }
        
        .form-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(135deg, ${colorScheme.accent} 0%, ${colorScheme.accentSecondary} 100%);
        }
        
        .price-highlight {
            background: linear-gradient(135deg, ${colorScheme.success} 0%, ${colorScheme.successSecondary} 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 30px;
            font-size: 1.3rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        }
        
        .form-container input {
            width: 100%;
            padding: 18px 24px;
            margin-bottom: 25px;
            border: 2px solid #e5e7eb;
            border-radius: 15px;
            font-size: 1.1rem;
            background: #f9fafb;
            color: #374151;
            transition: all 0.3s ease;
            font-weight: 500;
        }
        
        .form-container input:focus {
            outline: none;
            border-color: ${colorScheme.primary};
            background: white;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        
        .form-description {
            font-size: 1.1rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .form-subtitle {
            font-size: 0.95rem;
            color: #6b7280;
            margin-top: 25px;
            font-weight: 500;
        }
        
        .privacy-text {
            font-size: 0.85rem;
            color: #9ca3af;
            margin-top: 20px;
            font-weight: 400;
        }
        
        /* FAQ Section */
        .faq {
            padding: 80px 0;
            background: white;
        }
        
        .faq h2 {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 60px;
            color: #1a1a1a;
            position: relative;
        }
        
        .faq h2::after {
            content: '';
            position: absolute;
            bottom: -15px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 100%);
            border-radius: 2px;
        }
        
        .faq-item {
            background: linear-gradient(135deg, ${colorScheme.light} 0%, ${colorScheme.lightSecondary} 100%);
            margin-bottom: 20px;
            padding: 35px;
            border-radius: 20px;
            border-left: 6px solid ${colorScheme.primary};
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
            margin-bottom: 20px;
            transition: all 0.3s ease;
        }
        
        .faq-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.1);
        }
        
        .faq-question {
            font-weight: 700;
            font-size: 1.2rem;
            margin-bottom: 15px;
            color: #1a1a1a;
        }
        
        .faq-answer {
            color: #374151;
            line-height: 1.7;
            font-size: 1.05rem;
            font-weight: 500;
        }
        
        /* Guarantee Section */
        .guarantee {
            padding: 80px 0;
            background: linear-gradient(135deg, ${colorScheme.warning} 0%, ${colorScheme.warningSecondary} 100%);
            text-align: center;
            position: relative;
        }
        
        .guarantee::before {
            content: '🛡️';
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 3rem;
            opacity: 0.3;
        }
        
        .guarantee-content {
            position: relative;
            z-index: 2;
        }
        
        .guarantee h3 {
            font-size: 2.2rem;
            font-weight: 800;
            margin-bottom: 25px;
            color: white;
        }
        
        .guarantee p {
            max-width: 800px;
            margin: 0 auto;
            color: white;
            line-height: 1.7;
            font-size: 1.1rem;
            font-weight: 500;
        }
        
        /* Footer */
        .footer {
            padding: 50px 0;
            background: ${colorScheme.dark};
            color: #d1d5db;
            text-align: center;
        }
        
        .footer p {
            margin-bottom: 15px;
            font-weight: 500;
        }
        
        .footer-disclaimer {
            font-size: 0.9rem;
            color: #9ca3af;
            font-weight: 400;
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .hero .subheadline {
                font-size: 1.2rem;
            }
            
            .container {
                padding: 0 15px;
            }
            
            .form-container {
                margin: 0 15px;
                padding: 40px 30px;
            }
            
            .benefits-grid {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .benefit-item {
                padding: 25px;
            }
            
            .cta-button {
                padding: 18px 40px;
                font-size: 1.1rem;
            }
            
            .hero {
                padding: 60px 0;
            }
            
            .benefits, .form-section, .faq, .guarantee {
                padding: 60px 0;
            }
        }
        
        @media (max-width: 480px) {
            .hero h1 {
                font-size: 2rem;
            }
            
            .benefits h2, .faq h2 {
                font-size: 2rem;
            }
            
            .form-container {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <section class="header">
        <div class="container">
            <p class="header-subtitle">{{HEADER_SUBTITLE}}</p>
        </div>
    </section>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <h1>{{HERO_HEADLINE}}</h1>
                <p class="subheadline">{{HERO_SUBHEADLINE}}</p>
                <a href="#register" class="cta-button">{{CTA_BUTTON_TEXT}}</a>
            </div>
        </div>
    </section>

    <!-- Benefits Section -->
    <section class="benefits">
        <div class="container">
            <div class="benefits-content">
                <h2>What You Will Learn:</h2>
                <div class="benefits-grid">
                    {{BENEFITS_LIST}}
                </div>
            </div>
        </div>
    </section>

    <!-- Presenter Section -->
    <section class="presenter">
        <div class="container">
            <h3>Presented by {{PRESENTER_NAME}}</h3>
            <p class="presenter-subtitle">Workshop Expert & Industry Leader</p>
        </div>
    </section>

    <!-- Form Section -->
    <section class="form-section" id="register">
        <div class="container">
            <h3>{{FORM_TITLE}}</h3>
            
            <div class="form-container">
                <div class="price-highlight">
                    {{CTA_HIGHLIGHT}}
                </div>
                
                <p class="form-description">{{CTA_DESCRIPTION}}</p>
                
                <form>
                    <input type="email" placeholder="{{EMAIL_PLACEHOLDER}}" required>
                    <button type="submit" class="cta-button" style="width: 100%; margin: 0;">{{CTA_BUTTON_TEXT}}</button>
                </form>
                
                <p class="form-subtitle">{{FORM_SUBTITLE}}</p>
                <p class="privacy-text">We Respect Your Privacy & Information</p>
            </div>
        </div>
    </section>

    <!-- Guarantee Section -->
    <section class="guarantee">
        <div class="container">
            <div class="guarantee-content">
                <h3>{{GUARANTEE_TITLE}}</h3>
                <p>{{GUARANTEE_TEXT}}</p>
            </div>
        </div>
    </section>

    <!-- FAQ Section -->
    <section class="faq">
        <div class="container">
            <h2>Frequently Asked Questions</h2>
            {{FAQ_ITEMS}}
        </div>
    </section>

    <!-- Final CTA -->
    <section class="form-section">
        <div class="container">
            <h3>Ready to Transform Your Business?</h3>
            
            <div class="form-container">
                <div class="price-highlight">
                    {{CTA_HIGHLIGHT}}
                </div>
                
                <p class="form-description">{{CTA_DESCRIPTION}}</p>
                
                <form>
                    <input type="email" placeholder="{{EMAIL_PLACEHOLDER}}" required>
                    <button type="submit" class="cta-button" style="width: 100%; margin: 0;">{{CTA_BUTTON_TEXT}}</button>
                </form>
                
                <p class="form-subtitle">{{FORM_SUBTITLE}}</p>
                <p class="privacy-text">We Respect Your Privacy & Information</p>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <p>{{FOOTER_COPYRIGHT}}</p>
            <p class="footer-disclaimer">{{FOOTER_DISCLAIMER}}</p>
        </div>
    </footer>
</body>
</html>`;

    // Generate benefits list HTML for the new grid layout
    const benefitsList = copyData.benefitsList.map(benefit => 
      `<div class="benefit-item">
        <div class="benefit-text">${benefit}</div>
      </div>`
    ).join('\n                    ');
    
    // Generate FAQ items HTML
    const faqItems = copyData.faqItems.map(faq => `
            <div class="faq-item">
                <div class="faq-question">${faq.question}</div>
                <div class="faq-answer">${faq.answer}</div>
            </div>`).join('\n');

    // Replace all placeholders with Claude-generated content
    let populatedHTML = htmlTemplate
      .replace(/{{PAGE_TITLE}}/g, copyData.pageTitle)
      .replace(/{{HEADER_SUBTITLE}}/g, copyData.headerSubtitle)
      .replace(/{{HERO_HEADLINE}}/g, copyData.heroHeadline)
      .replace(/{{HERO_SUBHEADLINE}}/g, copyData.heroSubheadline)
      .replace(/{{BENEFITS_LIST}}/g, benefitsList)
      .replace(/{{PRESENTER_NAME}}/g, copyData.presenterName)
      .replace(/{{FORM_TITLE}}/g, copyData.formTitle)
      .replace(/{{CTA_HIGHLIGHT}}/g, copyData.ctaHighlight)
      .replace(/{{CTA_DESCRIPTION}}/g, copyData.ctaDescription)
      .replace(/{{EMAIL_PLACEHOLDER}}/g, copyData.emailPlaceholder)
      .replace(/{{CTA_BUTTON_TEXT}}/g, copyData.ctaButtonText)
      .replace(/{{FORM_SUBTITLE}}/g, copyData.formSubtitle)
      .replace(/{{GUARANTEE_TITLE}}/g, copyData.guaranteeTitle)
      .replace(/{{GUARANTEE_TEXT}}/g, copyData.guaranteeText)
      .replace(/{{FAQ_ITEMS}}/g, faqItems)
      .replace(/{{FOOTER_COPYRIGHT}}/g, copyData.footerCopyright)
      .replace(/{{FOOTER_DISCLAIMER}}/g, copyData.footerDisclaimer);

    console.log('[CHAT_API_DEBUG] HTML template populated with Claude-generated copy');
    return populatedHTML;

  } catch (error) {
    console.error('[CHAT_API_DEBUG] Error generating Claude copy for workshop HTML:', error);
    
    // Fallback to basic template if Claude generation fails
    const fallbackHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workshop Registration</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Workshop Registration</h1>
        <p>Join our upcoming workshop and transform your skills!</p>
        <p><strong>What you'll learn:</strong> ${collectedAnswers.topicsAndActivities || 'Valuable skills and strategies'}</p>
        <p><strong>Duration:</strong> ${collectedAnswers.workshopDuration || 'Full workshop experience'}</p>
        <p><strong>Resources:</strong> ${collectedAnswers.resourcesProvided || 'Comprehensive materials'}</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="#register" class="cta-button">Register Now</a>
        </div>
    </div>
</body>
</html>`;
    
    return fallbackHTML;
   }
}

export { generateWorkshopHTML };

