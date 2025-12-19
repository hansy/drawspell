import type { FC } from 'react';

import { useMultiplayerBoardController } from './useMultiplayerBoardController';
import { MultiplayerBoardView } from './MultiplayerBoardView';

interface MultiplayerBoardProps {
    sessionId: string;
}

export const MultiplayerBoard: FC<MultiplayerBoardProps> = ({ sessionId }) => {
    const controller = useMultiplayerBoardController(sessionId);
    return <MultiplayerBoardView {...controller} />;
};
