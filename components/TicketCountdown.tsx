import React from 'react';
import { Clock } from 'lucide-react';
import { Ticket } from '../types';

export const TicketCountdown: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>("");
  const [isWarning, setIsWarning] = React.useState<boolean>(false);
  const [isExpired, setIsExpired] = React.useState<boolean>(false);

  React.useEffect(() => {
    const calculateTime = () => {
      let startMs = 0;
      if (ticket.createdAt) {
        startMs = new Date(ticket.createdAt).getTime();
      } else if (ticket.date && ticket.openedAt) {
        try {
          const [h, m] = ticket.openedAt.split(":");
          const d = new Date(ticket.date);
          d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
          startMs = d.getTime();
        } catch (e) {
          startMs = new Date(ticket.date).getTime();
        }
      } else {
        startMs = new Date().getTime();
      }

      const nowMs = Date.now();
      // 8-hour Commercial limit (SLA) countdown
      const limitMs = startMs + 8 * 60 * 60 * 1000;
      const diffMs = limitMs - nowMs;

      if (diffMs <= 0) {
        setTimeLeft("Prazo Excedido");
        setIsExpired(true);
        setIsWarning(true);
      } else {
        setIsExpired(false);
        const hours = Math.floor(diffMs / (3600 * 1000));
        const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

        const hh = String(hours).padStart(2, "0");
        const mm = String(mins).padStart(2, "0");
        const ss = String(secs).padStart(2, "0");

        setTimeLeft(`${hh}h ${mm}m ${ss}s`);
        setIsWarning(hours < 2); // warn under 2 hours
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [ticket]);

  return (
    <div className="mt-2">
      {/* SLA countdown timer */}
      {isExpired ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 text-red-700 border border-red-200">
          <Clock className="w-3.5 h-3.5 animate-pulse text-red-600" />
          <span className="text-[10px] font-black uppercase tracking-wider">
            Prazo Excedido
          </span>
        </div>
      ) : (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
            isWarning
              ? "bg-amber-100 border-amber-300 text-amber-800 animate-pulse"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <Clock
            className={`w-3.5 h-3.5 ${isWarning ? "text-amber-500 animate-bounce" : "text-emerald-500"}`}
          />
          <span className="text-[10px] font-black uppercase tracking-wider">
            Tempo Restante:{" "}
            <span className="font-extrabold text-sm font-mono ml-1">
              {timeLeft}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};
