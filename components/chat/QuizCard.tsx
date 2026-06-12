'use client';

import { useState } from 'react';

export interface QuizCardQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explanation: string;
}

interface Props {
  questions: QuizCardQuestion[];
}

/**
 * Interactive quiz rendered inside an assistant message (via /quiz).
 * Each question locks after the first pick: the correct option turns emerald,
 * a wrong pick turns red (with the right answer highlighted), and the
 * explanation appears. The score summary at the top updates live.
 */
export function QuizCard({ questions }: Props) {
  // picked[i] = chosen option index for question i; null = not yet answered.
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));

  if (questions.length === 0) return null;

  const answered = picked.filter((p) => p !== null).length;
  const correct = picked.filter((p, i) => p !== null && p === questions[i]?.answer).length;

  const choose = (qi: number, oi: number) =>
    setPicked((prev) => {
      if (prev[qi] !== null) return prev; // locked once answered
      const next = [...prev];
      next[qi] = oi;
      return next;
    });

  const reset = () => setPicked(questions.map(() => null));

  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 space-y-5 max-w-2xl">
      {/* Live score summary + reset */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--ink-3)] tabular-nums">
          {answered}/{questions.length} answered · {correct} correct
        </span>
        {answered > 0 && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-2.5 py-1 rounded-lg border border-[var(--line)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try again
          </button>
        )}
      </div>

      {questions.map((q, qi) => {
        const sel = picked[qi];
        const isAnswered = sel !== null;
        return (
          <div key={qi} className="space-y-2">
            <p className="text-sm font-semibold text-[var(--ink)] leading-6">
              {qi + 1}. {q.q}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => {
                const isCorrect = oi === q.answer;
                const isPicked = sel === oi;
                let cls = 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--fill)]';
                if (isAnswered) {
                  if (isCorrect) cls = 'border-emerald-600 bg-emerald-600/10 text-emerald-600';
                  else if (isPicked) cls = 'border-red-400 bg-red-400/10 text-red-400';
                  else cls = 'border-[var(--line)] text-[var(--ink-4)] opacity-70';
                }
                return (
                  <button
                    key={oi}
                    onClick={() => choose(qi, oi)}
                    disabled={isAnswered}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${cls} ${
                      isAnswered ? 'cursor-default' : ''
                    }`}
                  >
                    <span className="min-w-0">{opt}</span>
                    {isAnswered && isCorrect && <span className="flex-shrink-0 font-semibold">✓</span>}
                    {isAnswered && isPicked && !isCorrect && <span className="flex-shrink-0 font-semibold">✗</span>}
                  </button>
                );
              })}
            </div>
            {isAnswered && q.explanation && (
              <p className="text-[13px] leading-6 text-[var(--ink-3)] bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-2">
                <span className={`font-medium ${sel === q.answer ? 'text-emerald-600' : 'text-red-400'}`}>
                  {sel === q.answer ? 'Correct! ' : 'Not quite. '}
                </span>
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
