import { Logo } from '@/components/layout/Logo';

export function TypingIndicator() {
  return (
    <div className="animate-msg-in flex gap-3 items-start">
      <Logo size={28} round className="mt-0.5" />
      <div className="flex items-center gap-1.5 h-7">
        <span className="w-2 h-2 rounded-full bg-[var(--ink-3)] animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 rounded-full bg-[var(--ink-3)] animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 rounded-full bg-[var(--ink-3)] animate-bounce" />
      </div>
    </div>
  );
}
