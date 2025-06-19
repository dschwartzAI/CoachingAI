# Hybrid Offer Creator - N8N Workflow Update Guide

## Overview
This guide explains how to update your n8n workflow to handle the enhanced Hybrid Offer Creator with offer type routing and the new streamlined question structure.

## What's New

### Updated Questions Structure:
1. **offerType** (FIRST) - Routes to different templates
2. **offerDescription** - Core product/service description
3. **targetAudience** - Specific target audience details
4. **painPoints** - Main challenges faced
5. **promiseSolution** - Combined promise and solution approach
6. **clientResult** - Specific success story
7. **plan** - Unique method or system
8. **phases** - Client journey stages
9. **paymentTerms** - Payment options
10. **guaranteeScarcity** - Combined guarantee and urgency elements

### Data Structure from Frontend

The n8n webhook will now receive:
```json
{
  "chatId": "uuid",
  "answers": {
    "offerType": "Consulting",
    "offerDescription": "Business scaling consulting for service companies",
    "targetAudience": "Service business owners doing $100K-$500K annually",
    "painPoints": "Stuck at revenue plateau, working too many hours",
    "promiseSolution": "Help them break through to $1M ARR using our proven scaling system with weekly strategy calls and implementation support",
    "clientResult": "Helped ABC Company go from $300K to $800K in 12 months",
    "plan": "3-phase system: Audit → Optimize → Scale with weekly accountability",
    "phases": "Foundation (month 1) → Growth (months 2-4) → Scale (months 5-6)",
    "paymentTerms": "$5,000 one-time or $1,500/month for 4 months",
    "guaranteeScarcity": "100% money-back guarantee if no 50% revenue increase in 6 months + only 5 spots available this quarter"
  },
  "toolId": "hybrid-offer",
  "userId": "user-uuid"
}
```

## N8N Workflow Updates Required

### 1. Update Webhook Node
The webhook will receive the streamlined data structure with 10 questions instead of 13.

### 2. Offer Type Routing
Create conditional branches based on `offerType`:

```javascript
// Switch node conditions
switch({{$json.answers.offerType}}) {
  case 'Membership':
    return 'membership_template';
  case 'Community':
    return 'community_template';
  case 'Consulting':
    return 'consulting_template';
  case 'Service':
    return 'service_template';
  case 'Product':
    return 'product_template';
  case 'Course':
    return 'course_template';
  default:
    return 'generic_template';
}
```

### 3. Template Updates
Update your template nodes to use the new combined fields:

#### Combined Promise & Solution
```javascript
// Old way (separate fields)
const promise = {{$json.answers.promise}};
const solution = {{$json.answers.solution}};

// New way (combined field)
const promiseSolution = {{$json.answers.promiseSolution}};
```

#### Combined Guarantee & Scarcity
```javascript
// Old way (separate fields)
const guarantee = {{$json.answers.guarantee}};
const scarcity = {{$json.answers.scarcity}};

// New way (combined field)
const guaranteeScarcity = {{$json.answers.guaranteeScarcity}};
```

#### Updated Client Results
```javascript
// Old field name
const clientResults = {{$json.answers.clientResults}};

// New field name
const clientResult = {{$json.answers.clientResult}};
```

### 4. Template Generation Examples

#### Consulting Template
```javascript
const offerTemplate = `
# ${{{$json.answers.offerDescription}}} for ${{{$json.answers.targetAudience}}}

## The Problem
${{{$json.answers.painPoints}}}

## Our Promise & Solution
${{{$json.answers.promiseSolution}}}

## Proven Results
${{{$json.answers.clientResult}}}

## Our Unique Method
${{{$json.answers.plan}}}

## Your Journey
${{{$json.answers.phases}}}

## Investment Options
${{{$json.answers.paymentTerms}}}

## Risk-Free Guarantee & Urgency
${{{$json.answers.guaranteeScarcity}}}
`;
```

#### Service Template
```javascript
const serviceTemplate = `
# ${{{$json.answers.offerDescription}}}

**Perfect for:** ${{{$json.answers.targetAudience}}}

**We solve:** ${{{$json.answers.painPoints}}}

**What you get:** ${{{$json.answers.promiseSolution}}}

**Proof it works:** ${{{$json.answers.clientResult}}}

**Our process:** ${{{$json.answers.plan}}}

**Timeline:** ${{{$json.answers.phases}}}

**Pricing:** ${{{$json.answers.paymentTerms}}}

**Guarantee:** ${{{$json.answers.guaranteeScarcity}}}
`;
```

### 5. Response Processing
Update your response nodes to handle the streamlined data:

```javascript
// Extract key information for follow-up
const extractedData = {
  offerType: {{$json.answers.offerType}},
  businessFocus: {{$json.answers.offerDescription}},
  targetMarket: {{$json.answers.targetAudience}},
  mainProblem: {{$json.answers.painPoints}},
  solution: {{$json.answers.promiseSolution}},
  proof: {{$json.answers.clientResult}},
  method: {{$json.answers.plan}},
  journey: {{$json.answers.phases}},
  pricing: {{$json.answers.paymentTerms}},
  riskReversal: {{$json.answers.guaranteeScarcity}}
};
```

## Testing Your Updated Workflow

### Test Data
Use this sample data to test your updated workflow:

```json
{
  "chatId": "test-123",
  "answers": {
    "offerType": "Consulting",
    "offerDescription": "Revenue optimization consulting for SaaS startups",
    "targetAudience": "SaaS founders with $50K-$200K MRR looking to scale",
    "painPoints": "Hitting growth plateaus, inefficient sales processes, high churn",
    "promiseSolution": "Increase MRR by 3x in 12 months using our proven revenue optimization framework with bi-weekly strategy sessions and implementation support",
    "clientResult": "Helped TechCorp increase MRR from $80K to $240K in 8 months with 40% reduction in churn",
    "uniqueMechanism": "4-pillar system: Sales Optimization → Retention Improvement → Pricing Strategy → Growth Acceleration",
    "phases": "Assessment (weeks 1-2) → Optimization (weeks 3-8) → Acceleration (weeks 9-12)",
    "paymentTerms": "$15,000 one-time or $3,000/month for 6 months",
    "guaranteeScarcity": "Double your MRR or full refund + only 3 clients accepted per quarter"
  },
  "toolId": "hybrid-offer",
  "userId": "test-user"
}
```

## Migration Checklist

- [ ] Update webhook to handle new data structure
- [ ] Create offer type routing logic
- [ ] Update all template nodes for new combined fields
- [ ] Test each offer type template
- [ ] Update response processing
- [ ] Test with sample data
- [ ] Deploy and monitor

## Benefits of New Structure

1. **Streamlined Process**: Reduced from 13 to 10 questions
2. **Better User Experience**: Combined related questions
3. **Cleaner Data**: More focused answers
4. **Easier Processing**: Fewer fields to manage
5. **Better Templates**: More cohesive offer creation

The new structure maintains all the essential elements while making the process more efficient for users and easier to manage in n8n workflows. 

## Data Structure Sent to N8N

The N8N webhook now receives the following JSON structure:

```json
{
  "chatId": "uuid-string",
  "answers": {
    "offerType": "string",
    "offerDescription": "string", 
    "targetAudience": "string",
    "painPoints": "string",
    "promiseSolution": "string",
    "clientResult": "string",
    "uniqueMechanism": "string",
    "phases": "string", 
    "guaranteeScarcity": "string",
    "paymentTerms": "string"
  },
  "conversation": [...],
  "timestamp": "ISO-string",
  "firstName": "string"
}
```

### New Fields Added

- **firstName**: The user's first name extracted from their profile (e.g., "Daniel", "Sarah")
- **offerType**: The type of offer for template routing
- **promiseSolution**: The transformation promise
- **clientResult**: Specific client success story
- **uniqueMechanism**: System/methodology name
- **phases**: Client journey stages
- **guaranteeScarcity**: Combined guarantee and scarcity elements

## N8N Workflow Updates

### 1. Switch Node for Offer Type Routing

Add a Switch node immediately after the webhook trigger:

**Node Name**: `Route by Offer Type`
**Field**: `{{$json["answers"]["offerType"]}}`

**Routing Rules**:
- **Route 1**: `membership` (contains) → Membership Template
- **Route 2**: `coaching` (contains) → Coaching Template  
- **Route 3**: `service` (contains) → B2B Service Template
- **Route 4**: `course` (contains) → Course/Program Template
- **Default**: → Generic Template

### 2. Template Structure for Each Offer Type

Each route should connect to a specialized Google Doc template:

#### Membership/Community Template
```
# {{$json["answers"]["offerDescription"]}} - {{$json["firstName"]}}

## Overview
Transform {{$json["answers"]["targetAudience"]}} with our exclusive membership...

## The Promise
{{$json["answers"]["promiseSolution"]}}

## Methodology: {{$json["answers"]["uniqueMechanism"]}}
[Detailed methodology content]

## Member Journey
{{$json["answers"]["phases"]}}

## Proof of Results
{{$json["answers"]["clientResult"]}}

## Guarantee & Urgency
{{$json["answers"]["guaranteeScarcity"]}}

## Investment Options
{{$json["answers"]["paymentTerms"]}}
```

#### Coaching/Consultant Template
```
# {{$json["firstName"]}}'s Coaching Program: {{$json["answers"]["offerDescription"]}}

## Who This Is For
{{$json["answers"]["targetAudience"]}}

## What You're Struggling With
{{$json["answers"]["painPoints"]}}

## The Transformation
{{$json["answers"]["promiseSolution"]}}

## My Proven System: {{$json["answers"]["uniqueMechanism"]}}
[Coaching methodology details]

## Your Journey
{{$json["answers"]["phases"]}}

## Success Story
{{$json["answers"]["clientResult"]}}

## My Guarantee
{{$json["answers"]["guaranteeScarcity"]}}

## Investment
{{$json["answers"]["paymentTerms"]}}
```

#### B2B Service Template
```
# {{$json["answers"]["offerDescription"]}} - Proposal for {{$json["firstName"]}}

## Executive Summary
For {{$json["answers"]["targetAudience"]}} facing {{$json["answers"]["painPoints"]}}...

## Solution Overview
{{$json["answers"]["promiseSolution"]}}

## Our Process: {{$json["answers"]["uniqueMechanism"]}}
[Service delivery methodology]

## Project Phases
{{$json["answers"]["phases"]}}

## Case Study
{{$json["answers"]["clientResult"]}}

## Terms & Guarantee
{{$json["answers"]["guaranteeScarcity"]}}

## Investment & Payment Terms
{{$json["answers"]["paymentTerms"]}}
```

#### Course/Program Template
```
# {{$json["firstName"]}}'s {{$json["answers"]["offerDescription"]}}

## Course Overview
Perfect for {{$json["answers"]["targetAudience"]}} who are tired of {{$json["answers"]["painPoints"]}}...

## What You'll Achieve
{{$json["answers"]["promiseSolution"]}}

## Curriculum: {{$json["answers"]["uniqueMechanism"]}}
[Course modules and content]

## Learning Path
{{$json["answers"]["phases"]}}

## Student Success
{{$json["answers"]["clientResult"]}}

## Guarantee & Enrollment
{{$json["answers"]["guaranteeScarcity"]}}

## Pricing Options
{{$json["answers"]["paymentTerms"]}}
```

### 3. Variable Mapping

Update all Google Docs nodes to use these variables:

**Personal**:
- `{{$json["firstName"]}}` - User's first name
- `{{$json["chatId"]}}` - Unique chat identifier
- `{{$json["timestamp"]}}` - Generation timestamp

**Core Offer**:
- `{{$json["answers"]["offerType"]}}` - Offer category
- `{{$json["answers"]["offerDescription"]}}` - What you do
- `{{$json["answers"]["targetAudience"]}}` - Who you serve

**Problem/Solution**:
- `{{$json["answers"]["painPoints"]}}` - Client struggles
- `{{$json["answers"]["promiseSolution"]}}` - Transformation promise
- `{{$json["answers"]["clientResult"]}}` - Success story

**Methodology**:
- `{{$json["answers"]["uniqueMechanism"]}}` - System/framework name
- `{{$json["answers"]["phases"]}}` - Client journey stages

**Conversion Elements**:
- `{{$json["answers"]["guaranteeScarcity"]}}` - Risk reversal + urgency
- `{{$json["answers"]["paymentTerms"]}}` - Pricing structure

### 4. Error Handling

Add error handling for missing fields:

```javascript
// Check for required fields
const requiredFields = ['offerType', 'offerDescription', 'targetAudience'];
const missing = requiredFields.filter(field => !$json.answers[field]);

if (missing.length > 0) {
  return {
    error: `Missing required fields: ${missing.join(', ')}`,
    chatId: $json.chatId
  };
}
```

### 5. Fallback Template

Create a generic template for unknown offer types:

```
# {{$json["firstName"]}}'s {{$json["answers"]["offerDescription"]}}

## Overview
{{$json["answers"]["offerDescription"]}} for {{$json["answers"]["targetAudience"]}}

## The Challenge
{{$json["answers"]["painPoints"]}}

## The Solution
{{$json["answers"]["promiseSolution"]}}

## Our Approach: {{$json["answers"]["uniqueMechanism"]}}
[Implementation details]

## Process
{{$json["answers"]["phases"]}}

## Results
{{$json["answers"]["clientResult"]}}

## Guarantee & Terms
{{$json["answers"]["guaranteeScarcity"]}}

## Investment
{{$json["answers"]["paymentTerms"]}}
```

## Implementation Steps

1. **Update Webhook Node**: Ensure it accepts all new fields
2. **Add Switch Node**: Route based on `offerType` field
3. **Create Templates**: Build specialized Google Doc templates for each offer type
4. **Update Variables**: Replace old field references with new structure
5. **Add Error Handling**: Handle missing or invalid data gracefully
6. **Test Routes**: Verify each offer type routes to correct template
7. **Add Fallback**: Ensure unknown types get generic template

## Testing Checklist

- [ ] Webhook receives firstName field correctly
- [ ] Switch node routes membership offers to membership template
- [ ] Switch node routes coaching offers to coaching template  
- [ ] Switch node routes service offers to B2B service template
- [ ] Switch node routes course offers to course template
- [ ] Unknown offer types route to fallback template
- [ ] All variable substitutions work correctly
- [ ] Error handling catches missing required fields
- [ ] Google Doc generation completes successfully
- [ ] Document link returns to chat interface

## Troubleshooting

**Common Issues**:
1. **Variable not found**: Check field name spelling in `{{$json["answers"]["fieldName"]}}`
2. **Route not working**: Verify Switch node conditions use "contains" operator
3. **Template not generating**: Check Google Docs node configuration
4. **Missing firstName**: Ensure user has completed their profile with full name

**Debug Steps**:
1. Check webhook payload in N8N execution log
2. Verify Switch node routing logic
3. Test variable substitution in template preview
4. Confirm Google Docs API permissions 