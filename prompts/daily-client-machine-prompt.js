// Daily Client Machine prompt templates

export const dcmIntroMessage = `Before we dive into building each page, we need to lay down a strong strategic foundation for your Daily Client Machine.

I'll guide you through 3 quick questions to design your funnel architecture, then we'll build out each page with professional copy you can use immediately.

**Let's begin with question 1 of 3:**

So let's tackle your Big Idea. This will become your "demo" - showing the exact system or mechanism that gets results for your clients.

Think of it as demonstrating a specific system, not just making claims. You'll show:
• The exact steps you take
• Who it's worked for
• How they can implement it

For example: "The 3-Step Authority System that books 5-10 high-ticket clients monthly without sales calls"

What's the specific system or mechanism you can demonstrate that solves your clients' biggest problem?

Your first asset will be a short "Big Idea Video". It's not hype— it's a live DEMO of your method in action.

Ask yourself:
• What ONE problem will I solve on camera?  
• What step-by-step system can I visibly walk through so prospects see it works?  
• What results or proof can I flash to prove it?  

Example Big Idea Demo: "Watch me set up the 3-Step Authority System that lands 5-10 high-ticket clients a month without sales calls."

Do you already have a memorable NAME for this system? If yes, share it— if not, we'll coin one.

So, what system will you demo in your Big Idea video and what would you like to call it?`;

// Daily Client Machine Copy Generation Template
export function generateDCMCopyTemplate(answers) {
  const {
    bigIdea,
    bigIdeaDescription,
    targetAudience,
    frontEndProduct,
    mainProblems,
    uniqueAdvantage,
    frontEndPrice,
    guarantee,
    orderBump,
    orderBumpPrice,
    mainUpsell,
    upsellPrice,
    typicalResults,
    clientSuccess,
    membershipOffer,
    membershipPrice,
    contentTopics,
    vslHook
  } = answers;

  return `# 🎯 YOUR COMPLETE DAILY CLIENT MACHINE FUNNEL COPY

*Generated on ${new Date().toLocaleDateString()} for ${targetAudience}*

---

## 📋 IMPLEMENTATION CHECKLIST

### Before You Start:
- [ ] HighLevel account ready
- [ ] DCM 2.0 template funnel cloned
- [ ] Domain connected
- [ ] Payment processor setup
- [ ] Email sequences prepared

### After Setup:
- [ ] Test all pages and forms
- [ ] Set up analytics tracking
- [ ] Create backup copies
- [ ] Launch traffic campaigns

---

## PAGE 1: OPT-IN PAGE (Lead Magnet)

### 🎯 **HEADLINE:**
**"Discover The ${bigIdeaDescription || 'Secret Method'} That ${bigIdea || 'Solves Your Biggest Problem'}"**

### 📝 **SUB-HEADLINE:**
Perfect for ${targetAudience} who want to ${bigIdea?.toLowerCase() || 'get better results'} without the usual struggles.

### 💡 **BULLET POINTS:**
• Get instant access to the ${frontEndProduct}
• Learn the exact ${bigIdeaDescription} system
• Overcome ${mainProblems?.split(',')[0] || 'your biggest challenge'}
• Start seeing results within days, not months

### 🎁 **LEAD MAGNET DESCRIPTION:**
"${frontEndProduct}" - Everything you need to ${bigIdea?.toLowerCase() || 'solve this problem'} starting today.

### 📞 **CALL TO ACTION:**
**"Get Instant Access - FREE"**

---

## PAGE 2: SALES PAGE (Main Offer)

### 🎯 **MAIN HEADLINE:**
**"Finally! The ${bigIdeaDescription} That ${bigIdea}"**

### 🔥 **HOOK:**
${vslHook || `If you're tired of struggling with ${mainProblems?.split(',')[0]?.toLowerCase() || 'the same old problems'}, this changes everything.`}

### ❌ **PROBLEM SECTION:**
**Here's what's NOT working:**

${mainProblems?.split(',').map((problem, index) => 
  `${index + 1}. ${problem.trim()}`
).join('\n') || '1. Traditional methods that waste time\n2. Expensive solutions that don\'t work\n3. Complicated systems that overwhelm you'}

### ✅ **SOLUTION SECTION:**
**The ${bigIdeaDescription} is different because:**

${uniqueAdvantage || 'It actually works'} - unlike everything else you've tried.

### 🎯 **WHAT YOU GET:**
Complete ${frontEndProduct} including:
• Step-by-step implementation guide
• Real-world examples and templates
• Bonus resources worth $XXX
• 30-day access to private community

### 💰 **PRICING:**
~~Regular Price: $97~~
**Today Only: $${frontEndPrice || '27'}**

### 🛡️ **GUARANTEE:**
${guarantee || '30-day money-back guarantee - if it doesn\'t work, you get every penny back.'}

### 📞 **CALL TO ACTION:**
**"Get ${frontEndProduct} for Only $${frontEndPrice || '27'} →"**

---

## PAGE 3: ORDER FORM

### 🎯 **HEADLINE:**
**"You're Almost There! Complete Your Order Below"**

### 📦 **ORDER SUMMARY:**
✅ ${frontEndProduct} - $${frontEndPrice || '27'}

### 🎁 **SPECIAL ORDER BUMP:**
**⬆️ ADD THIS TO YOUR ORDER:**

**"${orderBump}"** - Only $${orderBumpPrice || '37'} (Save $XX)

Perfect complement to your ${frontEndProduct}. This normally sells for $97, but you can add it today for just $${orderBumpPrice || '37'}.

☐ YES! Add ${orderBump} for only $${orderBumpPrice || '37'} more

### 💳 **PAYMENT FORM:**
[Standard checkout form fields]

### 📞 **CTA BUTTON:**
**"Complete My Order Now →"**

---

## PAGE 4: ORDER BUMP PAGE

### 🎯 **HEADLINE:**
**"Wait! Add ${orderBump} Before You Go"**

### ⏰ **URGENCY:**
This offer expires when you leave this page.

### 💡 **VALUE PROPOSITION:**
${orderBump} will help you ${bigIdea?.toLowerCase() || 'get even better results'} by providing:

• Advanced strategies not covered in the main course
• Done-for-you templates and examples
• Bonus case studies and real results
• Additional implementation support

### 💰 **SPECIAL PRICING:**
Regular Price: $97
**One-Time Offer: $${orderBumpPrice || '37'}**

### 📞 **DUAL CTA:**
**"YES - Add This To My Order for $${orderBumpPrice || '37'}" | "No Thanks, Continue"**

---

## PAGE 5: UPSELL PAGE

### 🎯 **HEADLINE:**
**"Congratulations! Here's How To 10X Your Results..."**

### 🚀 **UPGRADE OFFER:**
You just got the ${frontEndProduct}. Now let me show you how to ${typicalResults || 'multiply your results'}.

### 📦 **THE COMPLETE ${mainUpsell?.toUpperCase() || 'SYSTEM'}:**
${mainUpsell || 'Advanced implementation system'} includes:

• Everything in your previous purchase
• Advanced video training (3+ hours)
• Live Q&A session access
• Done-for-you templates
• 90-day implementation plan
• Private mastermind access

### 🏆 **PROOF:**
${clientSuccess || 'Our clients see amazing results with this system.'}

### 💰 **LIMITED TIME PRICING:**
Regular Value: $497
**Your Price Today: $${upsellPrice || '197'}**

### 📞 **CALL TO ACTION:**
**"Upgrade My Order for $${upsellPrice || '197'} →"**

---

## PAGE 6: THANK YOU PAGE

### 🎉 **HEADLINE:**
**"Welcome! Your ${frontEndProduct} Is Ready"**

### 📧 **NEXT STEPS:**
1. Check your email for login details
2. Join our private community
3. Schedule your implementation time
4. Follow the quick-start guide

### 📈 **WHAT TO EXPECT:**
${typicalResults || 'You should start seeing results within the first 30 days.'}

### 👥 **SUCCESS STORY:**
"${clientSuccess || 'This system changed everything for me. Within 90 days, I had completely transformed my business.'}"

### 🔗 **IMPORTANT LINKS:**
• Access Your Training →
• Join Private Community →
• Download Resources →
• Contact Support →

### 📞 **NEXT OPPORTUNITY:**
Ready to take this even further? 
**"Learn About Our Premium Coaching Program →"**

---

## PAGE 7: MEMBERSHIP OFFER PAGE

### 🎯 **HEADLINE:**
**"Join ${membershipOffer?.split(' ')[0] || 'The'} Community That's ${bigIdea}"**

### 🏆 **EXCLUSIVE ACCESS:**
${membershipOffer || 'Monthly coaching, resources, and community support'}

### 📅 **WHAT'S INCLUDED:**
• Monthly live coaching calls
• Private member community
• New training every month
• Direct access to me
• Resource library
• Implementation support

### 💰 **INVESTMENT:**
${membershipPrice || '$97/month'} - Cancel anytime

### 🎁 **SPECIAL OFFER:**
First month for just $9 (then ${membershipPrice || '$97/month'})

### 📞 **CALL TO ACTION:**
**"Join For $9 Today →"**

---

## PAGE 8: DELIVERY PAGE

### 🎯 **WELCOME HEADER:**
**"Welcome to Your ${frontEndProduct} Training Area"**

### 📚 **TRAINING MODULES:**
${contentTopics?.split(',').map((topic, index) => 
  `Module ${index + 1}: ${topic.trim()}`
).join('\n') || 'Module 1: Getting Started\nModule 2: Implementation\nModule 3: Advanced Strategies'}

### 🎥 **FEATURED VIDEO:**
**"${vslHook || 'Watch this first - it explains everything'}"**

### 📁 **DOWNLOAD SECTION:**
• Templates and worksheets
• Bonus resources
• Implementation checklist
• Case studies

### 💬 **COMMUNITY ACCESS:**
Join thousands of others implementing ${bigIdeaDescription}:
**"Access Private Community →"**

### 📞 **SUPPORT:**
Need help? **"Contact Support"** | **"Schedule 1:1 Call"**

---

## 🎯 COPY OPTIMIZATION NOTES

### A/B TEST VARIATIONS:
1. **Headlines:** Test emotional vs. logical appeals
2. **CTAs:** Test urgency vs. benefit-focused buttons
3. **Pricing:** Test different price points and displays
4. **Social Proof:** Test different testimonials and case studies

### COMPLIANCE CHECKLIST:
- [ ] Income disclaimers added where needed
- [ ] Privacy policy linked
- [ ] Terms of service included
- [ ] Refund policy clearly stated
- [ ] Contact information provided

### PERFORMANCE TRACKING:
- [ ] Conversion pixels installed
- [ ] Analytics tracking setup
- [ ] A/B testing tools configured
- [ ] Email sequences connected

---

## 📞 IMPLEMENTATION INSTRUCTIONS

### 1. **HIGHLEVEL SETUP:**
1. Clone DCM 2.0 template funnel
2. Replace template copy with your personalized copy above
3. Update all form connections
4. Set up automation sequences
5. Test all page flows

### 2. **TRAFFIC STRATEGY:**
1. Start with warm traffic (email list, social media)
2. Use the opt-in page for lead generation
3. Drive traffic to sales page for immediate conversions
4. Scale with paid traffic once profitable

### 3. **OPTIMIZATION:**
1. Monitor conversion rates on each page
2. Test different headlines and CTAs
3. Collect feedback from customers
4. Continuously improve based on data

---

*🚀 Your Daily Client Machine is ready to generate both clients AND customers daily!*

*Need help implementing? Consider joining our premium coaching program for hands-on support.*`;
}

// Additional helper prompts for specific sections
export const dcmSystemPrompt = `You are helping create a Daily Client Machine (DCM) — a dual-mode funnel system that generates both customers and clients.

Incorporate the following core insights distilled from James Kemp's DCM 2.0 playbook and accompanying workshop transcript so the user is automatically guided by "James-level" strategy and nuance while they build:

★ Strategic Foundations
1. The Big Idea must be presented as a DEMO of a mechanism or system — SHOW how it works rather than claim it works.  
2. Your chosen *style* dictates the medium:   
   • Google Docs or slides if you write like James  
   • iPad sketches if you teach visually like Taki  
   Encourage users to pick the medium that best matches their natural style so delivery feels effortless.
3. Headlines are responsible for ~50 % of conversion — craft & test them first.
4. Reveal the transformation by revealing the *making-of* process ("show the work"), e.g. behind-the-scenes screenshots, loom walkthroughs, live build sessions.
5. Use specific numbers, time-frames and concrete results everywhere (e.g. "37 qualified leads in 14 days").

★ Offer Architecture
6. Front-end product delivers a quick *win* at a low price to acquire customers.
7. Each upsell should be the logical next step (ladder of commitment) and feel like a *done-for-you* or *accelerator* of the front-end promise.
8. The Membership (continuity) provides ongoing implementation support + community — position it as the *next natural level* rather than an after-thought.
9. Stack risk-reversal elements: clear guarantees, social proof, and friction-free refunds.

★ Copy & Messaging Rules
10. Speak to both *information seekers* (want to know "how") and *transformation seekers* (want the result done) in the same piece of copy.  
11. Open loops & curiosity early, then close them with visual proof (screenshots, charts, dashboards).  
12. Every page section should answer "What's in it for me *right now*?"
13. Keep tone conversational, coach-like and directive — imagine James on a Zoom call walking the user through screens.
14. Use second person ("you") and active verbs; cut fluff.

Follow these principles as you generate prompts, page copy, and guidance. Your job is to act like a senior funnel strategist embedded in the user's team, translating their raw answers into conversion-ready assets while continually reminding them *why* each element matters.`;

// Page-specific copy generation for the new incremental approach
export function generatePageCopy(pageId, answers) {
  const {
    bigIdea,
    bigIdeaDescription,
    targetAudience,
    frontEndProduct,
    mainProblems,
    uniqueAdvantage,
    frontEndPrice,
    guarantee,
    orderBump,
    orderBumpPrice,
    mainUpsell,
    upsellPrice,
    typicalResults,
    clientSuccess,
    membershipOffer,
    membershipPrice,
    contentTopics,
    vslHook
  } = answers;

  switch(pageId) {
    case 'opt-in':
      return `# 📧 OPT-IN PAGE COPY

## 🎯 MAIN HEADLINE:
**"Discover The ${bigIdeaDescription || 'Secret Method'} That ${bigIdea || 'Solves Your Biggest Problem'}"**

## 📝 SUB-HEADLINE:
Perfect for ${targetAudience} who want ${bigIdea?.toLowerCase() || 'better results'} without the usual struggles.

## 💡 BULLET POINTS:
• Get instant access to the ${frontEndProduct}
• Learn the exact ${bigIdeaDescription} system  
• Start seeing results within days, not months
• Join thousands of successful ${targetAudience.toLowerCase()}

## 🎁 LEAD MAGNET:
"${frontEndProduct}" - Everything you need to ${bigIdea?.toLowerCase() || 'solve this problem'} starting today.

## 📞 CALL TO ACTION:
**"Get Instant Access - FREE"**

## 🔗 FORM FIELDS:
- First Name
- Email Address
- [Optional] Phone Number

---
*✅ Ready to implement? Copy this directly into your HighLevel opt-in page!*

**Would you like to continue to the sales page? Just say "generate sales page" or let me know if you want to refine this copy first.**`;

    case 'sales-page':
      return `# 💰 SALES PAGE COPY (VSL/DEMO PAGE)

## 🎯 MAIN HEADLINE:
**"Finally! The ${bigIdeaDescription} That ${bigIdea}"**

## 🔥 OPENING HOOK:
${vslHook || `If you're tired of struggling with ${mainProblems?.split(',')[0]?.toLowerCase() || 'the same problems'}, this changes everything.`}

## ❌ PROBLEM SECTION:
**Here's what's NOT working:**

${mainProblems?.split(',').map((problem, index) => 
  `${index + 1}. ${problem.trim()}`
).join('\n') || '1. Traditional methods that waste time\n2. Expensive solutions that don\'t deliver\n3. Complicated systems that overwhelm'}

## ✅ SOLUTION DEMONSTRATION:
**Let me show you exactly how ${bigIdeaDescription} works:**

**Step 1:** ${uniqueAdvantage?.split('.')[0] || 'The foundational element'}
**Step 2:** How to implement it in your business
**Step 3:** The specific results you'll see

*[This is where your VSL/demo video goes - showing the exact system in action]*

## 👥 WHO THIS WORKS FOR:
This has already worked for ${targetAudience.toLowerCase()} who:
• Want ${bigIdea?.toLowerCase()}
• Are tired of ${mainProblems?.split(',')[0]?.toLowerCase() || 'complex solutions'}
• Ready to implement a proven system

## 🎯 WHAT YOU GET:
Complete ${frontEndProduct} including:
• The exact ${bigIdeaDescription} system I just demonstrated
• Step-by-step implementation guide
• Real case studies showing how others did it
• Templates and tools to make it easy
• 30-day access to private community

## 💰 PRICING:
~~Regular Price: $97~~
**Today Only: $${frontEndPrice || '27'}**

## 🛡️ GUARANTEE:
${guarantee || '30-day money-back guarantee - if this system doesn\'t work for you, you get every penny back.'}

## 📞 CALL TO ACTION:
**"Get The ${bigIdeaDescription} System for Only $${frontEndPrice || '27'} →"**

---
*✅ Copy this into your HighLevel sales page. Remember: Your VSL should DEMONSTRATE the system, not just talk about it!*

**Ready for the order form? Say "generate order form" or let me know if you want to refine this copy.**`;

    case 'order-form':
      return `# 🛒 ORDER FORM COPY

## 🎯 HEADLINE:
**"You're Almost There! Complete Your Order Below"**

## 📦 ORDER SUMMARY:
✅ ${frontEndProduct} - $${frontEndPrice || '27'}

## 🎁 SPECIAL ORDER BUMP:
**⬆️ ADD THIS TO YOUR ORDER:**

**"${orderBump}"** - Only $${orderBumpPrice || '37'} (Save $XX)

Perfect complement to your ${frontEndProduct}. This normally sells for $97, but you can add it today for just $${orderBumpPrice || '37'}.

☐ YES! Add ${orderBump} for only $${orderBumpPrice || '37'} more

## 💳 PAYMENT SECTION:
[HighLevel will handle the payment form]

## 📞 SUBMIT BUTTON:
**"Complete My Order Now →"**

---
*✅ Set this up in your HighLevel order form with the bump offer enabled!*

**Continue to upsell page? Say "generate upsell" or refine this copy first.**`;

    case 'upsell':
      return `# 🚀 UPSELL PAGE COPY

## 🎯 HEADLINE:
**"Congratulations! Here's How To 10X Your Results..."**

## 🚀 UPGRADE OFFER:
You just got the ${frontEndProduct}. Now let me show you how to ${typicalResults || 'multiply your results'}.

## 📦 THE COMPLETE SYSTEM:
${mainUpsell || 'Advanced implementation system'} includes:

• Everything in your previous purchase
• Advanced video training (3+ hours)
• Live Q&A session access
• Done-for-you templates
• 90-day implementation plan
• Private mastermind access

## 🏆 PROOF:
${clientSuccess || 'Our clients see amazing results with this system.'}

## 💰 LIMITED TIME PRICING:
Regular Value: $497
**Your Price Today: $${upsellPrice || '197'}**

## 📞 CALL TO ACTION:
**"Upgrade My Order for $${upsellPrice || '197'} →"**

---
*✅ Set this up as your upsell page in HighLevel's funnel sequence!*

**Ready for thank you page? Say "generate thank you page" to continue.**`;

    case 'thank-you':
      return `# 🎉 THANK YOU PAGE COPY

## 🎉 HEADLINE:
**"Welcome! Your ${frontEndProduct} Is Ready"**

## 📧 NEXT STEPS:
1. Check your email for login details
2. Join our private community
3. Schedule your implementation time
4. Follow the quick-start guide

## 📈 WHAT TO EXPECT:
${typicalResults || 'You should start seeing results within the first 30 days.'}

## 👥 SUCCESS STORY:
"${clientSuccess || 'This system changed everything for me. Within 90 days, I had completely transformed my business.'}"

## 🔗 IMPORTANT LINKS:
• Access Your Training →
• Join Private Community →
• Download Resources →
• Contact Support →

## 📞 NEXT OPPORTUNITY:
Ready to take this even further? 
**"Learn About Our Premium Coaching Program →"**

---
*✅ Use this on your HighLevel thank you page with proper link redirects!*

**Continue to membership offer? Say "generate membership page" to keep going.**`;

    case 'membership':
      return `# 👥 MEMBERSHIP OFFER PAGE COPY

## 🎯 HEADLINE:
**"Join The Community That's ${bigIdea}"**

## 🏆 EXCLUSIVE ACCESS:
${membershipOffer || 'Monthly coaching, resources, and community support'}

## 📅 WHAT'S INCLUDED:
• Monthly live coaching calls
• Private member community
• New training every month
• Direct access to experts
• Resource library
• Implementation support

## 💰 INVESTMENT:
${membershipPrice || '$97/month'} - Cancel anytime

## 🎁 SPECIAL OFFER:
First month for just $9 (then ${membershipPrice || '$97/month'})

## 📞 CALL TO ACTION:
**"Join For $9 Today →"**

---
*✅ Set up this membership offer in HighLevel with proper billing integration!*

**Finally, say "generate delivery page" for the member area.**`;

    case 'delivery':
      return `# 📚 DELIVERY PAGE COPY

## 🎯 WELCOME HEADER:
**"Welcome to Your ${frontEndProduct} Training Area"**

## 📚 TRAINING MODULES:
${contentTopics?.split(',').map((topic, index) => 
  `Module ${index + 1}: ${topic.trim()}`
).join('\n') || 'Module 1: Getting Started\nModule 2: Implementation\nModule 3: Advanced Strategies'}

## 🎥 FEATURED VIDEO:
**"${vslHook || 'Watch this first - it explains everything'}"**

## 📁 DOWNLOAD SECTION:
• Templates and worksheets
• Bonus resources
• Implementation checklist
• Case studies

## 💬 COMMUNITY ACCESS:
Join thousands implementing ${bigIdeaDescription}:
**"Access Private Community →"**

## 📞 SUPPORT:
Need help? **"Contact Support"** | **"Schedule 1:1 Call"**

---
*✅ Upload this content to your HighLevel member area or course platform!*

**🎉 CONGRATULATIONS! Your complete Daily Client Machine funnel is ready!**

**Want the complete export? Say "export complete funnel" to get everything in one document.**`;

    default:
      return generateDCMCopyTemplate(answers);
  }
}

// Export all prompts
export default {
  dcmIntroMessage,
  generateDCMCopyTemplate,
  generatePageCopy,
  dcmSystemPrompt
}; 