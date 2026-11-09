'use client';

interface BatchProgressProps {
  done: number;
  total: number;
  label: string;
  detail?: string;
}

/** Progress bar for work that is sent to the server in several requests. */
export default function BatchProgress({ done, total, label, detail }: BatchProgressProps) {
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className="p-4 bg-primary/10 text-primary rounded-lg" role="status">
      <p className="font-medium mb-2">{label}</p>
      <div
        className="w-full bg-primary/20 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
      >
        <div
          className="bg-primary h-2 rounded-full transition-all motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail && <p className="text-sm mt-2">{detail}</p>}
    </div>
  );
}
