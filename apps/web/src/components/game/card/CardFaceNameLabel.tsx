import React from "react";

export const CardFaceNameLabel: React.FC<{
  showNameLabel: boolean;
  displayName: string;
}> = ({ showNameLabel, displayName }) => {
  if (!showNameLabel) return null;

  return (
    <div className="absolute left-1/2 bottom-full w-[160%] -translate-x-1/2 flex justify-center z-10 pointer-events-auto">
      <div
        className="bg-zinc-900/90 text-zinc-100 lg:text-xs px-1.5 py-0.5 rounded-sm border border-zinc-700 shadow-sm leading-tight text-center inline-block w-fit max-w-full break-words text-ellipsis"
      >
        {displayName}
      </div>
    </div>
  );
};
