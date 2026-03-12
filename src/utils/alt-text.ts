import * as fs from 'fs';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const CHARACTER_PROMPT = `Describe this screenshot from "The Adventures of Pete & Pete" (1993-1996 Nickelodeon show) in one concise sentence for image alt text.

Key characters to identify by appearance:
- Big Pete Wrigley: teenage boy, brown hair, narrator, often wears flannel
- Little Pete Wrigley: younger boy, distinctive red/orange hair, sometimes wears a cape
- Artie, the Strongest Man in the World: adult man in a metallic silver superhero outfit
- Ellen Hickle: teenage girl, dark hair, Big Pete's neighbor
- Nona Mecklenberg: girl with short blonde hair, athletic/tomboy style
- Endless Mike Hellstrom: larger teenage boy, neighborhood bully
- Joyce "Mom" Wrigley: mother, red hair
- Don "Dad" Wrigley: father, wears glasses

Setting: suburban New Jersey, early 1990s.

Describe what's happening in the scene and identify any recognizable characters. Keep it under 200 characters.`;

export async function generateVisionAltText(imagePath: string, fallbackAltText: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackAltText;
  }

  try {
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: CHARACTER_PROMPT,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.warn(`Alt text API returned ${response.status}, using fallback`);
      return fallbackAltText;
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
    };
    const generatedText = data.content?.[0]?.text?.trim();

    if (generatedText && generatedText.length > 0) {
      console.log(`Vision alt text: ${generatedText}`);
      return generatedText;
    }

    return fallbackAltText;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Alt text generation failed: ${message}, using fallback`);
    return fallbackAltText;
  }
}
