import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { messages } = await request.json();
    const contextMessages = messages.slice(0, 4).map(msg => ({
      role: msg.role,
      content: msg.content.substring(0, 500)
    }));
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Generate a concise, descriptive title (max 5 words) for this conversation. The title should capture the main topic or purpose. Do not use quotes or punctuation. Examples: Marketing Strategy Discussion, Website Debugging Help, Product Launch Planning"
        },
        ...contextMessages,
        {
          role: "user",
          content: "Based on the above conversation, generate a short descriptive title."
        }
      ],
      max_tokens: 20,
      temperature: 0.7,
    });
    const title = completion.choices[0].message.content.trim();
    return NextResponse.json({ title });
  } catch (error) {
    console.error('Title generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate title' },
      { status: 500 }
    );
  }
} 