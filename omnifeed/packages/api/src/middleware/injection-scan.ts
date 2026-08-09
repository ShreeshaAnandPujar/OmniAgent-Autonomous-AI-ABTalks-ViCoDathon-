/**
 * Regex-only prompt injection scanner.
 * No LLM calls -- heuristic pattern matching only.
 */

const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, weight: 0.9, label: 'ignore_instructions' },
  { pattern: /forget\s+(all\s+)?your\s+instructions/i, weight: 0.9, label: 'forget_instructions' },
  { pattern: /you\s+are\s+now\s+/i, weight: 0.7, label: 'role_reassignment' },
  { pattern: /disregard\s+(all\s+)?prior/i, weight: 0.85, label: 'disregard_prior' },
  { pattern: /override\s+(your\s+)?(system|instructions|rules)/i, weight: 0.85, label: 'override_system' },
  { pattern: /new\s+instructions?\s*:/i, weight: 0.8, label: 'new_instructions' },
  { pattern: /system\s*prompt\s*:/i, weight: 0.8, label: 'system_prompt_injection' },
  { pattern: /\bDAN\b.*\bjailbreak/i, weight: 0.9, label: 'jailbreak_attempt' },
  { pattern: /do\s+anything\s+now/i, weight: 0.75, label: 'do_anything_now' },
  { pattern: /act\s+as\s+(if|though)\s+you/i, weight: 0.6, label: 'act_as_bypass' },
  { pattern: /pretend\s+(you\s+are|to\s+be)/i, weight: 0.5, label: 'pretend_role' },
  { pattern: /ignore\s+safety/i, weight: 0.9, label: 'ignore_safety' },
  { pattern: /bypass\s+(filter|restriction|safeguard)/i, weight: 0.85, label: 'bypass_filters' },
  { pattern: /reveal\s+(your\s+)?(system|hidden|secret)\s+(prompt|instructions)/i, weight: 0.8, label: 'reveal_prompt' },
];

export interface InjectionScanResult {
  riskScore: number;
  detectedPatterns: string[];
  hasRisk: boolean;
}

export function scanForInjection(content: string): InjectionScanResult {
  const detectedPatterns: string[] = [];
  let maxScore = 0;

  for (const { pattern, weight, label } of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      detectedPatterns.push(label);
      if (weight > maxScore) {
        maxScore = weight;
      }
    }
  }

  // If multiple patterns detected, boost the score (but cap at 1.0)
  const combinedScore = detectedPatterns.length > 1
    ? Math.min(1, maxScore + detectedPatterns.length * 0.05)
    : maxScore;

  return {
    riskScore: Math.round(combinedScore * 100) / 100,
    detectedPatterns,
    hasRisk: combinedScore > 0.4,
  };
}
