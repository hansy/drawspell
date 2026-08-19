import React from "react";

import { cn } from "@/lib/utils";
import { CARD_CORNER_CLASS } from "@/lib/constants";

export const CardFaceArtwork: React.FC<{
  faceDown?: boolean;
  displayImageUrl?: string;
  displayName: string;
  imageClassName?: string;
  imageTransform?: string;
  imageLoading?: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
  imageFetchPriority?: React.ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
}> = ({
  faceDown,
  displayImageUrl,
  displayName,
  imageClassName,
  imageTransform,
  imageLoading = "lazy",
  imageFetchPriority = "auto",
}) => {
  if (faceDown) {
    return (
      <div
        data-card-face-artwork="back"
        className={cn(
          "w-full h-full overflow-hidden bg-indigo-900/50 flex items-center justify-center bg-[url('/mtg_card_back.jpeg')] bg-cover bg-center",
          CARD_CORNER_CLASS,
        )}
      />
    );
  }

  if (displayImageUrl) {
    return (
      <img
        src={displayImageUrl}
        alt={displayName}
        loading={imageLoading}
        fetchPriority={imageFetchPriority}
        decoding="async"
        draggable={false}
        data-card-face-artwork="front"
        className={cn(
          "block w-full h-full overflow-hidden object-cover pointer-events-none transition-transform duration-300 ease-out",
          CARD_CORNER_CLASS,
          imageClassName
        )}
        style={
          imageTransform
            ? { transform: imageTransform, transformOrigin: "center center" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="text-md text-center font-medium text-zinc-300 px-2">{displayName}</div>
  );
};
