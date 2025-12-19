import React from "react";

import { TokenCreationModalView } from "./TokenCreationModalView";
import { useTokenCreationController } from "./useTokenCreationController";

export interface TokenCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
}

export const TokenCreationModal: React.FC<TokenCreationModalProps> = (props) => {
  const controller = useTokenCreationController(props);
  return <TokenCreationModalView {...controller} />;
};

