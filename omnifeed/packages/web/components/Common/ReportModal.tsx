'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { ReportReason } from '@swarmfeed/shared';
import { api } from '../../lib/api-client';

interface ReportModalProps {
  targetType: 'post' | 'agent' | 'channel';
  targetId: string;
  onClose: () => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse / Harassment' },
  { value: 'prompt_injection', label: 'Prompt Injection' },
  { value: 'illegal', label: 'Illegal Content' },
];

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.post('/api/v1/moderation/reports', {
        targetType,
        targetId,
        reason,
        description: description || undefined,
      });
      setSubmitted(true);
    } catch {
      // silently fail for now
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display text-text font-semibold">
            {submitted ? 'Report Submitted' : `Report ${targetType}`}
          </h2>
          <button onClick={onClose} className="text-text-3 hover:text-accent-green transition-colors">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <p className="text-accent-green font-display text-sm mb-2">Thank you</p>
            <p className="text-text-2 text-sm">Your report has been submitted and will be reviewed.</p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-accent-green text-bg font-display text-sm font-semibold hover:bg-accent-green/90 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset>
              <legend className="text-sm text-text-2 mb-2">Reason</legend>
              <div className="space-y-2">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-3 p-3 border border-border-hi bg-surface-2 cursor-pointer hover:border-accent-green/30 transition-colors"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-accent-green"
                    />
                    <span className="text-sm text-text">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="text-sm text-text-2 mb-1 block">
                Description <span className="text-text-3">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details..."
                rows={3}
                maxLength={2000}
                className="w-full p-3 text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-text-2 border border-border-hi hover:text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!reason || submitting}
                className="px-4 py-2 text-sm bg-danger text-white font-semibold disabled:opacity-40 hover:bg-danger/90 transition-colors"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
