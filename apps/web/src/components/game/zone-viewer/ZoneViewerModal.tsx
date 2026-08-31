import React from "react";

import { ZoneViewerModalView } from "./ZoneViewerModalView";
import { useZoneViewerController } from "@/hooks/game/zone-viewer/useZoneViewerController";
import type { OpenCountPrompt } from "@/models/game/context-menu/menu/types";

interface ZoneViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  zoneId: string | null;
  count?: number; // If set, only show top X cards
  openCountPrompt?: OpenCountPrompt;
}

export const ZoneViewerModal: React.FC<ZoneViewerModalProps> = (props) => {
  const controller = useZoneViewerController(props);
  if (!controller) return null;
  return <ZoneViewerModalView {...controller} />;
};
