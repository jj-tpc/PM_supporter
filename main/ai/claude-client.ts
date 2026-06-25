// main/ai/claude-client.ts
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isApiKeyConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function* streamChat(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): AsyncGenerator<string, void, unknown> {
  const anthropic = getClient();

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' },
    }],
    messages,
    thinking: { type: 'adaptive' },
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
