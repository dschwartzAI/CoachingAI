import OpenAI from 'openai';
import { createParser } from 'eventsource-parser';

// This function converts OpenAI's streaming response to a ReadableStream
export default async function OpenAIStream(payload) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const stream = await openai.chat.completions.create({
    ...payload,
    stream: true,
  });

  return new ReadableStream({
    async start(controller) {
      // Function to handle each chunk from the OpenAI stream
      const onParse = (event) => {
        if (event.type === 'event') {
          const data = event.data;
          
          // OpenAI streams 'DONE' when the stream is complete
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          
          try {
            const json = JSON.parse(data);
            const text = json.choices[0]?.delta?.content || '';
            
            if (text) {
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            }
          } catch (e) {
            controller.error(e);
          }
        }
      };

      // Set up the parser for server-sent events
      const parser = createParser(onParse);
      
      for await (const chunk of stream) {
        parser.feed(decoder.decode(encoder.encode(JSON.stringify(chunk))));
      }
    },
  });
} 