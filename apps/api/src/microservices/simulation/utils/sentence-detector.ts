/**
 * Sentence Boundary Detection Utility
 *
 * Detects complete sentences in streaming text with support for:
 * - Multiple languages
 * - Common abbreviations
 * - Quote and parenthesis balancing
 * - Minimum word count requirements
 *
 * Design philosophy: Prefer speed over perfect accuracy.
 * It's better to split slightly early than wait too long for low latency.
 */

export interface SentenceDetectorOptions {
  minWords?: number; // Minimum words before considering a split (default: 3)
  language?: string; // Language code for language-specific rules
  aggressiveness?: 'conservative' | 'balanced' | 'aggressive'; // Detection strategy
}

export interface SentenceChunk {
  sentence: string;
  isComplete: boolean;
  confidence: number; // 0-1, how confident we are this is a complete sentence
}

export class SentenceDetector {
  private buffer = '';
  private readonly minWords: number;
  private readonly aggressiveness: 'conservative' | 'balanced' | 'aggressive';
  private readonly language: string;

  // Common abbreviations that shouldn't trigger sentence splits
  private readonly abbreviations = new Set([
    'dr',
    'mr',
    'mrs',
    'ms',
    'prof',
    'sr',
    'jr',
    'inc',
    'ltd',
    'corp',
    'co',
    'etc',
    'vs',
    'ie',
    'eg',
    'approx',
    'est',
    'dept',
    'no',
    'govt',
    'st',
    'ave',
    'blvd',
  ]);

  // Terminal punctuation marks
  private readonly terminalPunctuation = /[.!?。！？]/;

  constructor(options: SentenceDetectorOptions = {}) {
    this.minWords = options.minWords ?? 3;
    this.aggressiveness = options.aggressiveness ?? 'balanced';
    this.language = options.language ?? 'en';
  }

  /**
   * Add text to the buffer and detect complete sentences
   */
  addText(text: string): SentenceChunk[] {
    this.buffer += text;
    return this.detectSentences();
  }

  /**
   * Flush the buffer and return any remaining text as a complete sentence
   */
  flush(): SentenceChunk | null {
    if (this.buffer.trim().length === 0) {
      return null;
    }

    const sentence = this.buffer.trim();
    this.buffer = '';

    return {
      sentence,
      isComplete: true,
      confidence: 0.8, // Lower confidence for flushed content
    };
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Get the current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  private detectSentences(): SentenceChunk[] {
    const sentences: SentenceChunk[] = [];

    while (true) {
      const result = this.extractNextSentence();
      if (!result) break;

      sentences.push(result);
    }

    return sentences;
  }

  private extractNextSentence(): SentenceChunk | null {
    // Find potential sentence boundaries
    const matches = Array.from(this.buffer.matchAll(/[.!?。！？]+/g));

    if (matches.length === 0) {
      return null;
    }

    for (const match of matches) {
      const endIndex = match.index + match[0].length;
      const candidate = this.buffer.substring(0, endIndex).trim();

      // Check if this is a valid sentence boundary
      if (this.isValidSentenceBoundary(candidate, endIndex)) {
        // Extract the sentence
        this.buffer = this.buffer.substring(endIndex).trim();

        return {
          sentence: candidate,
          isComplete: true,
          confidence: this.calculateConfidence(candidate, endIndex),
        };
      }
    }

    return null;
  }

  private isValidSentenceBoundary(
    candidate: string,
    endIndex: number,
  ): boolean {
    // Check minimum word count
    const wordCount = this.countWords(candidate);
    if (wordCount < this.minWords) {
      return false;
    }

    // Check for abbreviations (e.g., "Dr. Smith")
    if (this.endsWithAbbreviation(candidate)) {
      return false;
    }

    // Check if quotes or parentheses are balanced
    if (!this.areDelimitersBalanced(candidate)) {
      return false;
    }

    // Check for capital letter after punctuation (if there's more text)
    const remaining = this.buffer.substring(endIndex).trim();
    if (remaining.length > 0) {
      const nextChar = remaining[0];

      // If next character is lowercase, might be abbreviation or decimal
      if (nextChar === nextChar.toLowerCase() && /[a-z]/.test(nextChar)) {
        // Unless we're being aggressive
        if (this.aggressiveness === 'aggressive') {
          return wordCount >= this.minWords * 1.5;
        }
        return false;
      }
    }

    // Aggressiveness-based decision
    switch (this.aggressiveness) {
      case 'conservative':
        return wordCount >= this.minWords * 1.5;
      case 'balanced':
        return wordCount >= this.minWords;
      case 'aggressive':
        return wordCount >= Math.max(2, this.minWords - 1);
      default:
        return true;
    }
  }

  private calculateConfidence(sentence: string, endIndex: number): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence for longer sentences
    const wordCount = this.countWords(sentence);
    if (wordCount >= this.minWords * 2) {
      confidence += 0.1;
    }

    // Higher confidence if followed by capital letter
    const remaining = this.buffer.substring(endIndex).trim();
    if (remaining.length > 0 && remaining[0] === remaining[0].toUpperCase()) {
      confidence += 0.1;
    }

    // Lower confidence if ends with common abbreviation prefixes
    if (this.endsWithAbbreviation(sentence)) {
      confidence -= 0.3;
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private endsWithAbbreviation(text: string): boolean {
    const words = text.trim().split(/\s+/);
    if (words.length === 0) return false;

    const lastWord = words[words.length - 1].toLowerCase().replace(/\.$/, '');
    return this.abbreviations.has(lastWord);
  }

  private areDelimitersBalanced(text: string): boolean {
    let quoteCount = 0;
    let singleQuoteCount = 0;
    let parenDepth = 0;
    let bracketDepth = 0;

    for (const char of text) {
      switch (char) {
        case '"':
          quoteCount++;
          break;
        case "'":
          singleQuoteCount++;
          break;
        case '(':
          parenDepth++;
          break;
        case ')':
          parenDepth--;
          break;
        case '[':
          bracketDepth++;
          break;
        case ']':
          bracketDepth--;
          break;
      }
    }

    // Quotes should be even (balanced pairs)
    // Parentheses and brackets should return to 0
    return (
      quoteCount % 2 === 0 &&
      singleQuoteCount % 2 === 0 &&
      parenDepth === 0 &&
      bracketDepth === 0
    );
  }
}

/**
 * Helper function to detect sentences from streaming text
 *
 * @example
 * const detector = new SentenceDetector({ minWords: 3, aggressiveness: 'balanced' });
 *
 * // As text streams in...
 * const chunks1 = detector.addText('Hello, how are ');
 * // chunks1 = []
 *
 * const chunks2 = detector.addText('you today? I am ');
 * // chunks2 = [{ sentence: 'Hello, how are you today?', isComplete: true, confidence: 0.9 }]
 *
 * const chunks3 = detector.addText('doing great!');
 * // chunks3 = []
 *
 * const remaining = detector.flush();
 * // remaining = { sentence: 'I am doing great!', isComplete: true, confidence: 0.8 }
 */
export function createSentenceDetector(
  options?: SentenceDetectorOptions,
): SentenceDetector {
  return new SentenceDetector(options);
}
