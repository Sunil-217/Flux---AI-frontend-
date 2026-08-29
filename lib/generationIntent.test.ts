import { describe, it, expect } from 'vitest';
import {
  detectImageRequest,
  extractTopic,
  isGenerationCandidate,
  isInformational,
  stripPolite,
  wantsImage,
} from './generationIntent';

/** What handleSendMessage does: slash first, then natural language. */
function route(text: string): 'image' | 'chat' {
  if (/^\/(image|video|pdf|excel|word|ppt)\s+[\s\S]+/i.test(text)) {
    return text.toLowerCase().startsWith('/image') ? 'image' : 'chat';
  }
  return detectImageRequest(text) ? 'image' : 'chat';
}

describe('image requests route to image generation', () => {
  it.each([
    '/image a cat',
    'draw a dog',
    'create an image of a car',
    'show me Vijay image',
    'Show me Vijay image',
    'show Vijay image',
    'give me a Vijay image',
    'I want an image of a mountain',
    'generate an image of a sunset',
    'create an image of a car',
    'make an image of a robot',
    'make a picture of a house',
    'create a picture of a car',
    'show me a picture of a dog',
    'make a photo of a bird',
    'draw Vijay',
  ])('%s', (text) => {
    expect(route(text)).toBe('image');
  });

  // The reported failure: polite wrappers and a trailing question mark made
  // these look like questions, so they reached the model — which then replied
  // with the literal text "/image <subject>, the …".
  it.each([
    'can you show me Vijay image',
    'Can you draw a dog',
    'could you generate an image of a cat',
    'can you make a picture of a house',
    'please draw a dog',
    'show me Vijay image?',
    'draw a dog?',
    'create an image of a car?',
  ])('previously leaked to the model: %s', (text) => {
    expect(route(text)).toBe('image');
  });
});

describe('questions about images stay in normal chat', () => {
  it.each([
    'What is image generation?',
    'What is an image model?',
    'Explain how image generation works',
    'What are diffusion models?',
    'Which model is used for image generation?',
    'Tell me about AI image generation',
    'How does image generation work?',
    'What are image generation models?',
    'Explain diffusion models',
    // Leads with "show" but asks about a concept.
    'show me how image generation works',
    'can you explain how image generation works',
    'what is the difference between an image and a photo',
  ])('%s', (text) => {
    expect(route(text)).toBe('chat');
  });
});

describe('extracted prompt keeps the user subject and invents nothing', () => {
  it('reduces "Show me Vijay image" to the subject alone', () => {
    expect(extractTopic('Show me Vijay image')).toBe('Vijay');
  });

  it.each([
    ['show me Vijay image', 'Vijay'],
    ['can you show me Vijay image', 'Vijay'],
    ['draw a dog', 'dog'],
    ['create an image of a car', 'car'],
    ['I want an image of a mountain', 'mountain'],
    ['make a picture of a house', 'house'],
  ])('%s -> %s', (text, topic) => {
    expect(extractTopic(text)).toBe(topic);
  });

  it('never adds biography, profession or location to the subject', () => {
    const topic = extractTopic('Show me Vijay image');
    for (const invented of ['chief minister', 'tamil nadu', 'actor', 'film', 'politician', 'born']) {
      expect(topic.toLowerCase()).not.toContain(invented);
    }
    // Only the subject survives — one word in, one word out.
    expect(topic.split(/\s+/)).toHaveLength(1);
  });

  it('keeps a multi-word subject intact', () => {
    expect(extractTopic('draw a red sports car')).toBe('red sports car');
  });
});

describe('polite wrappers', () => {
  it.each([
    ['can you draw a dog', 'draw a dog'],
    ['Could you please draw a dog', 'draw a dog'],
    ['please draw a dog', 'draw a dog'],
    ['hey can you draw a dog', 'draw a dog'],
    ['draw a dog', 'draw a dog'],
  ])('%s -> %s', (text, stripped) => {
    expect(stripPolite(text).toLowerCase()).toBe(stripped);
  });
});

describe('guards that must not weaken', () => {
  it('slash commands are never handled by the natural-language path', () => {
    expect(isGenerationCandidate('/image a cat')).toBe(false);
  });

  it('code requests never trigger image generation', () => {
    expect(detectImageRequest('create a function returning an image buffer')).toBeNull();
    expect(detectImageRequest('write a python script to render an image')).toBeNull();
  });

  it('very long messages are not treated as generation requests', () => {
    expect(detectImageRequest(`draw a dog ${'x'.repeat(500)}`)).toBeNull();
  });

  it('an image noun with no request verb is not a request', () => {
    expect(wantsImage('the image was blurry')).toBe(false);
    expect(wantsImage('image')).toBe(false);
  });

  it('a bare trailing question mark still marks a question when nothing is requested', () => {
    expect(isInformational('pdf?')).toBe(true);
    expect(isInformational('diffusion models?')).toBe(true);
  });

  it('document-format questions stay questions', () => {
    expect(isInformational('what is a pdf?')).toBe(true);
    expect(isInformational('how does excel work?')).toBe(true);
  });

  it('document generation requests remain candidates', () => {
    // These route to pdf/excel/word/ppt in AppLayout; the shared gate must
    // still let them through.
    expect(isGenerationCandidate('make a pdf about cats')).toBe(true);
    expect(isGenerationCandidate('can you make an excel of this data')).toBe(true);
    expect(isGenerationCandidate('create a powerpoint about sales')).toBe(true);
  });

  it('empty input is not a generation request', () => {
    expect(detectImageRequest('')).toBeNull();
    expect(detectImageRequest('   ')).toBeNull();
  });
});


// ── Romanised Tamil / Telugu / Hindi ─────────────────────────────────────────
// People type to this app in their own language far more than in textbook
// English. Each of these languages draws the same show/tell line English does
// — kaatu vs sollu, chupinchu vs cheppu, dikhao vs batao — and the detection
// follows that line rather than keyword-matching on the media noun.

describe('Tanglish image requests', () => {
  it.each([
    ['Vijay image kaatu', 'Vijay'],
    ['Vijay padam kaatu da', 'Vijay'],
    ['enaku oru cat image venum', 'cat'],
    ['oru dog padam podu', 'dog'],
    ['Vijay photo venum da', 'Vijay'],
    ['naku Vijay image kudu', 'Vijay'],
    ['cat padam varai', 'cat'],
    ['enakku oru sunset padam venum', 'sunset'],
  ])('%s -> image of %s', (text, topic) => {
    expect(route(text)).toBe('image');
    expect(detectImageRequest(text)?.topic).toBe(topic);
  });
});

describe('Telglish image requests', () => {
  it.each([
    ['Vijay photo chupinchu', 'Vijay'],
    ['naaku oka cat chitram kavali', 'cat'],
    ['dog bomma chupinchu', 'dog'],
    ['oka sunset photo kavali', 'sunset'],
  ])('%s -> image of %s', (text, topic) => {
    expect(route(text)).toBe('image');
    expect(detectImageRequest(text)?.topic).toBe(topic);
  });
});

describe('Hinglish image requests', () => {
  it.each([
    ['Vijay ki photo dikhao', 'Vijay'],
    ['mujhe ek cat image chahiye', 'cat'],
    ['dog ka photo banao', 'dog'],
    ['ek sunset ki tasveer banao', 'sunset'],
  ])('%s -> image of %s', (text, topic) => {
    expect(route(text)).toBe('image');
    expect(detectImageRequest(text)?.topic).toBe(topic);
  });
});

describe('regional questions ABOUT images stay in chat', () => {
  it.each([
    // Tamil — question word trailing is ordinary word order here.
    'image generation na enna',
    'image model nu enna',
    'image generation pathi sollu',
    'diffusion model epdi work agudhu',
    'AI image generation epdi velai seyyudhu',
    // Telugu
    'image generation ante enti',
    'image generation gurinchi cheppu',
    // Hindi
    'image generation kya hai',
    'image generation ke baare mein batao',
    'diffusion model kaise kaam karta hai',
  ])('%s', (text) => {
    expect(route(text)).toBe('chat');
  });
});

describe('the show/tell split holds across languages', () => {
  it.each([
    ['Vijay image kaatu', 'image'],   // Tamil show
    ['Vijay image pathi sollu', 'chat'],  // Tamil tell
    ['Vijay photo chupinchu', 'image'],   // Telugu show
    ['Vijay photo gurinchi cheppu', 'chat'], // Telugu tell
    ['Vijay ki photo dikhao', 'image'],   // Hindi show
    ['Vijay photo ke baare mein batao', 'chat'], // Hindi tell
  ])('%s -> %s', (text, expected) => {
    expect(route(text)).toBe(expected);
  });
});
