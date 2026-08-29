/**
 * Natural-language intent detection for the media/document generators.
 *
 * The user shouldn't have to remember slash commands: "draw a dog" and
 * "show me Vijay image" should generate an image, while "what is image
 * generation?" stays an ordinary question. This module decides which.
 *
 * It lives here rather than inside AppLayout because the decision is pure
 * string logic with a lot of edge cases, and edge cases need tests.
 *
 * Why this matters beyond routing: the chat system prompt tells the model that
 * image generation exists and to point users at `/image <prompt>`. So a missed
 * image request doesn't merely answer the wrong way — the model replies with
 * the literal text "/image <subject> …", often inventing biography for the
 * subject along the way. Getting the routing right is what stops that.
 */

export type GenerationKind = 'image' | 'pdf' | 'excel' | 'word' | 'ppt';

/**
 * Polite wrappers that turn a request into a grammatical question without
 * changing what is being asked for. "Can you draw a dog" is a request, not a
 * question about dogs, so these are stripped before anything else is judged.
 *
 * Only modal wrappers and courtesy words. "I want" is NOT stripped: "want" is
 * itself the verb that makes "I want an image of a mountain" a request, and
 * removing it leaves a noun phrase that reads like no request at all.
 */
const POLITE_PREFIX =
  /^\s*(?:(?:hey|hi|hello|ok|okay)[,\s]+)*(?:(?:please|pls|plz|kindly)\s+)*(?:(?:can|could|would|will|shall)\s+(?:you|u|we)\s+(?:please\s+)?)?(?:(?:please|pls|plz|kindly)\s+)*/i;

/**
 * Leading words that make a message a request for information. These are the
 * hard "this is a question" signal and are never overridden.
 *
 * Note "show" is deliberately absent while "tell" is present: "tell me about
 * X" asks for an explanation, "show me X" asks to be shown the thing.
 */
const INFORMATIONAL_LEAD =
  /^(what|how|why|when|where|which|whose|whom|is|are|am|was|were|do|does|did|explain|define|describe|difference|compare|tell|list|name|meaning)\b/i;

/**
 * Informational phrasing that can appear anywhere, not just at the start —
 * "show me how image generation works" leads with "show" but is still a
 * question about a concept.
 */
const INFORMATIONAL_PHRASE =
  /\b(?:how\b[\s\S]{0,40}\bworks?\b|how\s+to\b|what(?:'s| is| are)\b|explain\b|meaning\s+of\b|definition\s+of\b|tell\s+me\s+about\b|difference\s+between\b)/i;

/** Verbs that ask for something to be produced. */
const GENERATION_VERB =
  /\b(draw|sketch|illustrate|paint|make|create|generate|render|produce|design|show|give|want|need|build|draft|prepare|convert|turn|export|save|download|venum|vendum|kudu|kodu)\b/i;

/** Nouns naming a visual artefact. */
const IMAGE_NOUN =
  /\b(image|picture|photo|photograph|drawing|illustration|art|artwork|painting|sketch|pic|wallpaper|poster)\b/i;

/** Looks like a programming request, where "image" or "table" mean something else. */
const CODE_HINT =
  /\b(function|code|class|method|api|endpoint|script|program|backend|frontend|server|route|database|sql|html|css|javascript|typescript|python|java|component|library|framework|module|import|return|variable|array|loop)\b/i;

const MAX_LENGTH = 400;

/** Remove a leading politeness wrapper: "Can you please draw a dog" → "draw a dog". */
export function stripPolite(text: string): string {
  return text.replace(POLITE_PREFIX, '').trim();
}

/**
 * True when the message asks ABOUT something rather than FOR something.
 *
 * A trailing question mark alone is not enough. "Draw a dog?" and "show me
 * Vijay image?" are requests that happen to end in punctuation, and treating
 * them as questions is what sent them to the model in the first place. The
 * mark only counts when nothing in the message asks for something to be made.
 */
export function isInformational(text: string): boolean {
  const t = stripPolite(text);
  if (INFORMATIONAL_LEAD.test(t)) return true;
  if (INFORMATIONAL_PHRASE.test(t)) return true;
  return t.endsWith('?') && !GENERATION_VERB.test(t);
}

/** Does this ask for an image to be generated? */
export function wantsImage(text: string): boolean {
  const t = stripPolite(text);
  if (/^\s*(?:please\s+)?(draw|sketch|illustrate|paint)\b/i.test(t)) return true;
  return GENERATION_VERB.test(t) && IMAGE_NOUN.test(t);
}

/**
 * Reduce a request to the subject worth drawing: "Show me Vijay image" →
 * "Vijay". Only removes framing — verbs, articles, media nouns, filler — so
 * whatever the user actually named survives untouched. Nothing is added, which
 * is the point: the subject must not acquire a description the user never gave.
 */
export function extractTopic(text: string): string {
  return stripPolite(text)
    .replace(/\b(please|kindly|pls|can you|could you|i want|i need|i'd like|give me|make me|get me|show me)\b/gi, ' ')
    .replace(/\b(convert|make|turn|change|save|export|download|generate|create|write|draft|build|produce|prepare|render|design|draw|sketch|illustrate|paint|show|summari[sz]e)\b/gi, ' ')
    .replace(/\b(it|this|that|these|those|the|a|an|some|my|our|your|me|us)\b/gi, ' ')
    .replace(/\b(into|onto|to|as|has|in|now|just|also|then|and|please)\b/gi, ' ')
    .replace(/\b(pdf|document|doc|report|brief|paper|file|format|version|image|picture|photo|photograph|pic|drawing|illustration|art|artwork|painting|sketch|wallpaper|poster)\b/gi, ' ')
    .replace(/\b(excel|spreadsheet|xlsx|workbook|sheet|word|docx|ppt|pptx|powerpoint|presentation|slides?|deck|content|data|info|information|table)\b/gi, ' ')
    .replace(/\b(ha|aa|da|na|naku|enaku|yenaku|venum|vendum|kudu|kodu|pannu|panni)\b/gi, ' ')
    .replace(/\b(about|on|for|of|regarding|concerning|covering|titled|called|explaining)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the message is eligible for any natural-language generation route:
 * not a slash command, not a code request, not absurdly long, not a question.
 */
export function isGenerationCandidate(text: string): boolean {
  const t = text.trim();
  if (!t || t.startsWith('/') || t.length > MAX_LENGTH) return false;
  if (CODE_HINT.test(t)) return false;
  return !isInformational(t);
}

/**
 * The image decision in one call: the subject to draw, or null to fall through
 * to ordinary chat. `null` topic means "the user referred to something earlier"
 * — the caller supplies the previous subject.
 */
export function detectImageRequest(text: string): { topic: string } | null {
  if (!isGenerationCandidate(text) || !wantsImage(text)) return null;
  return { topic: extractTopic(text) };
}
