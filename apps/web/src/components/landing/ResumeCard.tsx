import { m } from "@/paraglide/messages.js";
type ResumeCardProps = {
  onReconnect: () => void;
  onLeave: () => void;
  isLeaving?: boolean;
};

export function ResumeCard({ onReconnect, onLeave, isLeaving = false }: ResumeCardProps) {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur">
      <h2 className="text-base font-semibold text-zinc-100">
        {m.resume_card_you_re_already_in_a_game()}</h2>
      <p className="mt-1 text-sm text-zinc-300">
        {m.resume_card_reconnect_to_your_last_session_or_leave_to_start_a_new_game()}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onReconnect}
          disabled={isLeaving}
          className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          {m.resume_card_reconnect()}</button>
        <button
          onClick={onLeave}
          disabled={isLeaving}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-white/10"
        >
          {isLeaving ? m.resume_card_leaving() : m.resume_card_leave_room()}
        </button>
      </div>
    </div>
  );
}
