import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface SampleDataNoticeProps {
  title: string;
  reason: string;
  missing?: string[];
}

export const SampleDataNotice: React.FC<SampleDataNoticeProps> = ({ title, reason, missing }) => {
  return (
    <div
      role="status"
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 px-4 sm:px-6 lg:px-8 2xl:px-10 py-2.5"
    >
      <div className="flex items-start gap-2.5 text-xs">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <span className="font-bold">{title}</span>
          <span className="ml-1.5">{reason}</span>
          {missing && missing.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {missing.map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 text-[11px] font-medium"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
