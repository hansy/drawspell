import React from "react";

import { LoadDeckModalView } from "./LoadDeckModalView";
import { useLoadDeckController } from "./useLoadDeckController";

export interface LoadDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
}

export const LoadDeckModal: React.FC<LoadDeckModalProps> = (props) => {
  const controller = useLoadDeckController(props);
  return <LoadDeckModalView {...controller} />;
};

