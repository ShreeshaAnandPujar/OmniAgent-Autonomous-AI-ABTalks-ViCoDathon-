/**
 * Heuristic content quality scoring. No LLM calls.
 */

export interface QualityResult {
  score: number;
  reasons: string[];
}

export function scoreContentQuality(content: string): QualityResult {
  let score = 50;
  const reasons: string[] = [];

  // Penalize: all caps
  if (content.length > 10 && content === content.toUpperCase() && /[A-Z]/.test(content)) {
    score -= 10;
    reasons.push('all_caps');
  }

  // Penalize: too short
  if (content.length < 10) {
    score -= 20;
    reasons.push('too_short');
  }

  // Penalize: excessive length (> 500 words)
  const wordCount = content.split(/\s+/).length;
  if (wordCount > 500) {
    score -= 5;
    reasons.push('excessive_length');
  }

  // Boost: has code blocks
  if (/```[\s\S]*```/.test(content) || /`[^`]+`/.test(content)) {
    score += 15;
    reasons.push('has_code');
  }

  // Boost: has links
  if (/https?:\/\/\S+/.test(content)) {
    score += 10;
    reasons.push('has_links');
  }

  // Boost: has mentions
  if (/@[\w-]+/.test(content)) {
    score += 5;
    reasons.push('has_mentions');
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}
