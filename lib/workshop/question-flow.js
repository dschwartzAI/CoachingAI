// Returns the next question object { key, question } or null if complete
export function getNextQuestion(context) {
  // Helper to mark collected flags if inferred
  const markCollected = (key) => {
    if (context.collected[key] === false) {
      context.collected[key] = true;
    }
  };

  // If outcome missing
  if (!context.outcome && !context.collected.outcome) {
    return {
      key: "outcome",
      question: "what specific transformation or result will participants walk away with?"
    };
  }

  // Infer audience description if possible
  if (!context.audience.description && !context.collected.audienceDescription) {
    if (
      context.audience.demographics.professions.length > 0 ||
      context.audience.demographics.businessType
    ) {
      context.audience.description = `${
        context.audience.demographics.businessType || "service-based"
      } businesses like ${context.audience.demographics.professions.join(", ")}`;
      markCollected("audienceDescription");
    }
  }

  if (context.audience.painPoints.length === 0 && !context.collected.painPoints) {
    return {
      key: "painPoints",
      question: "what's the biggest marketing challenge they're facing right now?"
    };
  }

  if (context.audience.painPoints.length > 0 && !context.problem) {
    context.problem = `Helping ${
      context.audience.description || "businesses"
    } overcome ${context.audience.painPoints.join(" and ")}`;
    return {
      key: "confirm",
      question: `So if I understand correctly, your workshop helps ${
        context.audience.description || "participants"
      } ${context.outcome} by addressing ${context.audience.painPoints.join(
        " and "
      )}. Is there anything else you'd like to add about the problem you're solving?`
    };
  }

  // All info collected
  return null;
} 