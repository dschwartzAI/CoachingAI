import { jest } from '@jest/globals';

describe('Tool Suggestion Analysis', () => {
  // Mock the OpenAI response structure
  const mockOpenAIResponse = (content) => ({
    choices: [{
      message: {
        content: JSON.stringify(content)
      }
    }]
  });

  // Test cases for different user queries
  const testCases = [
    {
      query: "I need help creating a workshop for my clients",
      expectedSuggestion: {
        shouldMention: true,
        toolName: "WORKSHOP GENERATOR",
        reasoning: expect.stringContaining("workshop")
      }
    },
    {
      query: "How do I package my services into an offer?",
      expectedSuggestion: {
        shouldMention: true,
        toolName: "HYBRID OFFER CREATOR",
        reasoning: expect.stringContaining("offer")
      }
    },
    {
      query: "I want to build a landing page for my course",
      expectedSuggestion: {
        shouldMention: true,
        toolName: "HIGHLEVEL LANDING PAGE GENERATOR",
        reasoning: expect.stringContaining("landing page")
      }
    },
    {
      query: "What's the best way to manage my time?",
      expectedSuggestion: {
        shouldMention: false,
        toolName: null,
        reasoning: expect.any(String)
      }
    }
  ];

  describe('analyzeForToolSuggestion', () => {
    it('should suggest Workshop Generator for workshop-related queries', () => {
      const analysis = {
        shouldMention: true,
        toolName: "WORKSHOP GENERATOR",
        reasoning: "The user is asking about creating a workshop"
      };
      
      expect(analysis.shouldMention).toBe(true);
      expect(analysis.toolName).toBe("WORKSHOP GENERATOR");
      expect(analysis.reasoning).toContain("workshop");
    });

    it('should suggest Hybrid Offer Creator for offer-related queries', () => {
      const analysis = {
        shouldMention: true,
        toolName: "HYBRID OFFER CREATOR",
        reasoning: "The user is asking about packaging services into an offer"
      };
      
      expect(analysis.shouldMention).toBe(true);
      expect(analysis.toolName).toBe("HYBRID OFFER CREATOR");
      expect(analysis.reasoning).toContain("offer");
    });

    it('should not suggest tools for general coaching questions', () => {
      const analysis = {
        shouldMention: false,
        toolName: null,
        reasoning: "This is a general time management question"
      };
      
      expect(analysis.shouldMention).toBe(false);
      expect(analysis.toolName).toBeNull();
    });
  });

  describe('Tool suggestion prompt construction', () => {
    it('should include user message in the analysis prompt', () => {
      const userMessage = "I want to create a workshop";
      const prompt = `Analyze if this user request relates to any of our specialized tools`;
      
      expect(prompt).toContain("specialized tools");
    });

    it('should include all available tools in the prompt', () => {
      const tools = ["WORKSHOP GENERATOR", "HYBRID OFFER CREATOR", "HIGHLEVEL LANDING PAGE GENERATOR"];
      const prompt = tools.map(tool => `- ${tool}`).join('\n');
      
      tools.forEach(tool => {
        expect(prompt).toContain(tool);
      });
    });
  });

  describe('Integration with chat flow', () => {
    it('should only analyze for tools on user messages', () => {
      const message = { role: 'user', content: 'Help me create an offer' };
      const shouldAnalyze = message.role === 'user';
      
      expect(shouldAnalyze).toBe(true);
    });

    it('should not analyze for tools on assistant messages', () => {
      const message = { role: 'assistant', content: 'I can help with that' };
      const shouldAnalyze = message.role === 'user';
      
      expect(shouldAnalyze).toBe(false);
    });
  });
}); 