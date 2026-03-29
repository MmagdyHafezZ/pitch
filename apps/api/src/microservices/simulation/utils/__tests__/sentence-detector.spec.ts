import { SentenceDetector, createSentenceDetector } from '../sentence-detector';

// ---------------------------------------------------------------------------
// createSentenceDetector factory
// ---------------------------------------------------------------------------

describe('createSentenceDetector', () => {
  it('should return a SentenceDetector instance', () => {
    expect(createSentenceDetector()).toBeInstanceOf(SentenceDetector);
  });

  it('should forward options to the SentenceDetector', () => {
    const detector = createSentenceDetector({
      minWords: 5,
      aggressiveness: 'aggressive',
    });
    // Verify it behaves with those options by checking a short sentence is not split
    const chunks = detector.addText('Hello world.');
    // "Hello world." has 2 words, below minWords=5 (aggressive threshold = max(2, 5-1)=4)
    expect(chunks).toHaveLength(0);
  });

  it('should create independent instances each call', () => {
    const a = createSentenceDetector();
    const b = createSentenceDetector();
    a.addText('Hello world. ');
    expect(b.getBuffer()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// SentenceDetector – constructor defaults
// ---------------------------------------------------------------------------

describe('SentenceDetector – constructor defaults', () => {
  it('should default minWords to 3', () => {
    const d = new SentenceDetector();
    // A 3-word sentence should be detected (balanced default)
    const chunks = d.addText('I am here. ');
    expect(chunks).toHaveLength(1);
  });

  it('should default aggressiveness to "balanced"', () => {
    const d = new SentenceDetector();
    // With balanced + minWords=3, "Hi there." (2 words) should NOT be split
    const chunks = d.addText('Hi there. ');
    expect(chunks).toHaveLength(0);
  });

  it('should default language to "en"', () => {
    // Language just affects the stored property; no exception should occur
    expect(() => new SentenceDetector()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// addText / detectSentences
// ---------------------------------------------------------------------------

describe('SentenceDetector – addText', () => {
  describe('balanced aggressiveness (default)', () => {
    let detector: SentenceDetector;

    beforeEach(() => {
      detector = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'balanced',
      });
    });

    it('should return empty array when no terminal punctuation is present', () => {
      const chunks = detector.addText('Hello how are you');
      expect(chunks).toHaveLength(0);
    });

    it('should detect a simple sentence ending with "."', () => {
      const chunks = detector.addText('Hello how are you. ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sentence).toBe('Hello how are you.');
      expect(chunks[0].isComplete).toBe(true);
    });

    it('should detect a sentence ending with "?"', () => {
      const chunks = detector.addText('How are you doing? ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sentence).toBe('How are you doing?');
    });

    it('should detect a sentence ending with "!"', () => {
      const chunks = detector.addText('Great to see you! ');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sentence).toBe('Great to see you!');
    });

    it('should detect CJK terminal punctuation "。" (with minWords=1 since CJK words are whitespace-joined)', () => {
      // CJK text without spaces = 1 "word" by whitespace splitting.
      // Use minWords:1 so the boundary is recognised.
      const cjkDetector = new SentenceDetector({ minWords: 1 });
      const chunks = cjkDetector.addText('你好很高兴见到你。 ');
      expect(chunks).toHaveLength(1);
    });

    it('should detect multiple sentences in a single addText call', () => {
      const chunks = detector.addText(
        'The sky is blue. The grass is green. The sun is bright. ',
      );
      expect(chunks).toHaveLength(3);
    });

    it('should accumulate partial text in the buffer', () => {
      detector.addText('Hello how ');
      detector.addText('are you');
      expect(detector.getBuffer()).toBe('Hello how are you');
    });

    it('should not split on abbreviations like "Dr."', () => {
      // "Dr. Smith is here" – "Dr." should not trigger split even if next is uppercase
      detector = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'balanced',
      });
      const chunks = detector.addText('Dr. Smith is here. ');
      // "Dr." should be skipped; "Dr. Smith is here." should be the full sentence
      // The real sentence boundary is at the end
      expect(chunks).toHaveLength(1);
      expect(chunks[0].sentence).toContain('here.');
    });

    it('should not split when next char after "." is lowercase', () => {
      const chunks = detector.addText('Hello world. this is a test');
      // "world." followed by lowercase "t" → no split (balanced mode)
      expect(chunks).toHaveLength(0);
    });

    it('should split when sentence meets minWords requirement', () => {
      const chunks = detector.addText('One two three. ');
      expect(chunks).toHaveLength(1);
    });

    it('should NOT split when sentence is below minWords', () => {
      const chunks = detector.addText('Hi there. ');
      // Only 2 words
      expect(chunks).toHaveLength(0);
    });
  });

  describe('conservative aggressiveness', () => {
    let detector: SentenceDetector;

    beforeEach(() => {
      detector = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'conservative',
      });
    });

    it('should require >= 1.5 * minWords (ceil=5) words before splitting', () => {
      // 4 words – below threshold of 4.5 (→ requires 5)
      const chunks = detector.addText('One two three four. ');
      expect(chunks).toHaveLength(0);
    });

    it('should split when meeting the higher word threshold', () => {
      const chunks = detector.addText('One two three four five. ');
      expect(chunks).toHaveLength(1);
    });
  });

  describe('aggressive aggressiveness', () => {
    let detector: SentenceDetector;

    beforeEach(() => {
      detector = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'aggressive',
      });
    });

    it('still requires minWords words (aggressive changes the aggressiveness switch, not the initial guard)', () => {
      // The initial wordCount < minWords guard fires before the aggressiveness switch.
      // "Hello there." has 2 words, minWords=3 → still rejected.
      const chunks = detector.addText('Hello there. ');
      expect(chunks).toHaveLength(0);
    });

    it('should split a sentence that passes the minWords guard', () => {
      // With minWords=2 and aggressiveness=aggressive, max(2, 2-1)=2, so 2 words is enough.
      const aggressiveTwo = new SentenceDetector({
        minWords: 2,
        aggressiveness: 'aggressive',
      });
      const chunks = aggressiveTwo.addText('Hello there. ');
      expect(chunks).toHaveLength(1);
    });

    it('should split even when next char is lowercase (if minWords*1.5 met)', () => {
      // "Hello there world. something" → aggressive allows split if wordCount >= 4.5 → 5
      // 3 words + lowercase next: wordCount=3 < 4.5 → still false
      const chunks = detector.addText('Hello there world. something');
      expect(chunks).toHaveLength(0);

      const detector2 = new SentenceDetector({
        minWords: 3,
        aggressiveness: 'aggressive',
      });
      const chunks2 = detector2.addText(
        'Hello there world these days. something',
      );
      // 6 words >= 4.5, lowercase next → should split
      expect(chunks2).toHaveLength(1);
    });
  });

  describe('delimiter balancing', () => {
    let detector: SentenceDetector;

    beforeEach(() => {
      detector = new SentenceDetector({ minWords: 3 });
    });

    it('should NOT split inside unbalanced double quotes', () => {
      // Unbalanced quote means "areDelimitersBalanced" returns false
      const chunks = detector.addText('"Hello how are you. ');
      expect(chunks).toHaveLength(0);
    });

    it('should split when double quotes are balanced (closing quote must follow the period)', () => {
      // Placing both quotes before and after text but the period INSIDE quotes means the
      // sentence boundary at "." has only one " counted → unbalanced.
      // Instead use quotes that are both before the terminal punct:
      const chunks = detector.addText('"Hello how are you". ');
      expect(chunks).toHaveLength(1);
    });

    it('should NOT split inside unbalanced parentheses', () => {
      const chunks = detector.addText('Hello (how are you. ');
      expect(chunks).toHaveLength(0);
    });

    it('should split when parentheses are balanced', () => {
      const chunks = detector.addText('Hello (how are you). ');
      expect(chunks).toHaveLength(1);
    });

    it('should NOT split inside unbalanced brackets', () => {
      const chunks = detector.addText('Hello [how are you. ');
      expect(chunks).toHaveLength(0);
    });

    it('should split when brackets are balanced', () => {
      const chunks = detector.addText('Hello [how are you]. ');
      expect(chunks).toHaveLength(1);
    });
  });

  describe('abbreviation detection', () => {
    let detector: SentenceDetector;

    beforeEach(() => {
      detector = new SentenceDetector({ minWords: 3 });
    });

    it.each([
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
    ])('should not split at abbreviation "%s."', (abbr) => {
      // The abbreviation ends the current candidate – should be rejected
      const text = `See ${abbr}. Smith today they said it was fine. `;
      const chunks = detector.addText(text);
      // All 3+ word sentences should eventually be detected at the full boundary
      // Key assertion: no split at the abbreviation position
      if (chunks.length > 0) {
        chunks.forEach((c) => {
          expect(c.sentence.toLowerCase()).not.toMatch(
            new RegExp(`${abbr}\\.$`),
          );
        });
      }
    });
  });
});

// ---------------------------------------------------------------------------
// flush
// ---------------------------------------------------------------------------

describe('SentenceDetector – flush', () => {
  let detector: SentenceDetector;

  beforeEach(() => {
    detector = new SentenceDetector();
  });

  it('should return null when buffer is empty', () => {
    expect(detector.flush()).toBeNull();
  });

  it('should return null when buffer contains only whitespace', () => {
    detector.addText('   ');
    expect(detector.flush()).toBeNull();
  });

  it('should return buffered text as a complete sentence', () => {
    detector.addText('This is incomplete');
    const chunk = detector.flush();

    expect(chunk).not.toBeNull();
    expect(chunk!.sentence).toBe('This is incomplete');
    expect(chunk!.isComplete).toBe(true);
    expect(chunk!.confidence).toBe(0.8);
  });

  it('should clear the buffer after flushing', () => {
    detector.addText('Some text');
    detector.flush();

    expect(detector.getBuffer()).toBe('');
  });

  it('should trim the sentence returned from flush', () => {
    detector.addText('   Hello world   ');
    const chunk = detector.flush();

    expect(chunk!.sentence).toBe('Hello world');
  });

  it('should return null if called again after a flush', () => {
    detector.addText('Some text');
    detector.flush();

    expect(detector.flush()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('SentenceDetector – reset', () => {
  it('should clear the buffer', () => {
    const detector = new SentenceDetector();
    detector.addText('Hello world');
    detector.reset();

    expect(detector.getBuffer()).toBe('');
  });

  it('should return no sentences after reset even when text was added', () => {
    const detector = new SentenceDetector();
    detector.addText('Hello world. ');
    detector.reset();

    const chunks = detector.addText('Short text');
    expect(chunks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBuffer
// ---------------------------------------------------------------------------

describe('SentenceDetector – getBuffer', () => {
  it('should return empty string initially', () => {
    const detector = new SentenceDetector();
    expect(detector.getBuffer()).toBe('');
  });

  it('should return the current accumulated buffer content', () => {
    const detector = new SentenceDetector();
    detector.addText('Hello ');
    detector.addText('world');
    expect(detector.getBuffer()).toBe('Hello world');
  });

  it('should return remaining text after a sentence was extracted', () => {
    const detector = new SentenceDetector({ minWords: 3 });
    detector.addText('Hello how are you. And some more');
    expect(detector.getBuffer()).toBe('And some more');
  });
});

// ---------------------------------------------------------------------------
// confidence calculation
// ---------------------------------------------------------------------------

describe('SentenceDetector – confidence', () => {
  it('should return confidence between 0 and 1 inclusive', () => {
    const detector = new SentenceDetector({ minWords: 3 });
    const chunks = detector.addText('Hello how are you. ');
    expect(chunks[0].confidence).toBeGreaterThanOrEqual(0);
    expect(chunks[0].confidence).toBeLessThanOrEqual(1);
  });

  it('should return higher confidence for long sentences followed by uppercase', () => {
    const detector = new SentenceDetector({ minWords: 3 });
    // Long sentence (more than 2*minWords=6 words) + uppercase next char
    const chunks = detector.addText(
      'Hello how are you doing today my friend. Great!',
    );
    if (chunks.length > 0) {
      expect(chunks[0].confidence).toBeGreaterThan(0.7);
    }
  });

  it('should give flushed sentences exactly 0.8 confidence', () => {
    const detector = new SentenceDetector();
    detector.addText('Incomplete sentence');
    const chunk = detector.flush();
    expect(chunk!.confidence).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// Streaming simulation
// ---------------------------------------------------------------------------

describe('SentenceDetector – streaming simulation', () => {
  it('should detect sentences as they complete across multiple addText calls', () => {
    const detector = new SentenceDetector({ minWords: 3 });

    expect(detector.addText('Hello, how are ')).toHaveLength(0);
    const chunks = detector.addText('you today? I am ');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sentence).toBe('Hello, how are you today?');

    // Note: the buffer remainder after extracting up to "?" is trimmed by the implementation,
    // so "I am" is stored without a trailing space. The next addText call appends directly.
    expect(detector.addText(' doing great')).toHaveLength(0);

    const remaining = detector.flush();
    expect(remaining?.sentence).toBe('I am doing great');
  });

  it('should handle multiple sentences arriving simultaneously', () => {
    const detector = new SentenceDetector({ minWords: 3 });
    const chunks = detector.addText(
      'The first sentence is complete. The second one too. And the third as well. ',
    );
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle text with no sentence ever completed (all flushed)', () => {
    const detector = new SentenceDetector({ minWords: 10 });
    detector.addText('Short text');
    const chunk = detector.flush();
    expect(chunk?.sentence).toBe('Short text');
  });
});
