export function parseUserResponse(response, context) {
  const updates = {};
  const lower = response.toLowerCase();

  // Pain points detection
  const painPointPatterns = [
    /inconsistent\s+[\w\s]+/gi,
    /wrong\s+[\w\s]+/gi,
    /struggl(?:e|es)\s+with\s+([^\.]+)/gi,
    /challenge(?:s)?\s+(?:are|is)\s+([^\.]+)/gi,
    /problem(?:s)?\s+(?:with|are)\s+([^\.]+)/gi
  ];

  painPointPatterns.forEach((pattern) => {
    const matches = response.matchAll(pattern);
    for (const match of matches) {
      const point = match[0].trim();
      if (point && !context.audience.painPoints.includes(point)) {
        context.audience.painPoints.push(point);
        updates.painPoints = true;
      }
    }
  });

  // Age range (e.g., "20-50")
  const ageMatch = response.match(/(\d{2})\s?-\s?(\d{2})/);
  if (ageMatch) {
    context.audience.demographics.age = `${ageMatch[1]}-${ageMatch[2]}`;
    updates.demographics = true;
  }

  // Professions keywords
  const professionKeywords = [
    "consultant",
    "coach",
    "agency",
    "freelancer",
    "therapist",
    "advisor",
    "teacher",
    "trainer"
  ];

  professionKeywords.forEach((prof) => {
    if (lower.includes(prof) && !context.audience.demographics.professions.includes(prof)) {
      context.audience.demographics.professions.push(prof);
      updates.demographics = true;
    }
  });

  // Business type inference
  if (lower.includes("service") || lower.includes("online")) {
    context.audience.demographics.businessType = "service-based";
    updates.businessType = true;
  }

  // Outcome extraction – simplistic (presence of "walk away with")
  const outcomeMatch = response.match(/walk\s+away\s+with\s+([^\.]*)/i);
  if (outcomeMatch && !context.outcome) {
    context.outcome = outcomeMatch[1].trim();
    updates.outcome = true;
  }

  return updates;
} 