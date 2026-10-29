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
      <CardFaceImage
        src={displayImageUrl}
        displayName={displayName}
        imageClassName={imageClassName}
        imageTransform={imageTransform}
        imageLoading={imageLoading}
        imageFetchPriority={imageFetchPriority}
      />
    );
  }

  return (
    <div className="text-md text-center font-medium text-zinc-300 px-2">{displayName}</div>
  );
};

// Shows the card name on a card-shaped placeholder until the art arrives, so a
// slow image never looks like an empty slot.
const CardFaceImage: React.FC<{
  src: string;
  displayName: string;
  imageClassName?: string;
  imageTransform?: string;
  imageLoading: React.ImgHTMLAttributes<HTMLImageElement>["loading"];
  imageFetchPriority: React.ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
}> = ({
  src,
  displayName,
  imageClassName,
  imageTransform,
  imageLoading,
  imageFetchPriority,
}) => {
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null);
  const loaded = loadedSrc === src;

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden [container-type:inline-size]",
        !loaded && "bg-zinc-800 ring-1 ring-inset ring-zinc-700",
        CARD_CORNER_CLASS,
      )}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          data-card-face-placeholder
          className="absolute inset-0 flex items-start justify-center p-[6%] text-center text-[9cqw] font-medium leading-tight text-zinc-300"
        >
          {displayName}
        </div>
      )}
      <img
        src={src}
        alt={displayName}
        loading={imageLoading}
        fetchPriority={imageFetchPriority}
        decoding="async"
        draggable={false}
        data-card-face-artwork="front"
        onLoad={() => setLoadedSrc(src)}
        className={cn(
          "relative block w-full h-full overflow-hidden object-cover pointer-events-none transition-[transform,opacity] duration-300 ease-out",
          !loaded && "opacity-0",
          CARD_CORNER_CLASS,
          imageClassName
        )}
        style={
          imageTransform
            ? { transform: imageTransform, transformOrigin: "center center" }
            : undefined
        }
      />
    </div>
  );
};
