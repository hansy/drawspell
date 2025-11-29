import React from 'react';
import { cn } from '../../../lib/utils';
import { Zone as ZoneType, Card as CardType, Player } from '../../../types';
import { Card } from '../Card/Card';
import { Zone } from '../Zone/Zone';
import { CARD_WIDTH_PX, CARD_HEIGHT_PX } from '../../../lib/constants';

interface BattlefieldProps {
    zone: ZoneType;
    cards: CardType[];
    player: Player;
    isTop: boolean;
    scale?: number;
    onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const Battlefield: React.FC<BattlefieldProps> = ({
    zone,
    cards,
    player,
    isTop,
    scale = 1,
    onCardContextMenu,
    onContextMenu
}) => {
    return (
        <div
            className={cn(
                "flex-1 relative",
                isTop ? "order-last" : "order-first"
            )}
            onContextMenu={onContextMenu}
        >
            <Zone
                zone={zone}
                className="w-full h-full relative"
                layout="free-form"
                scale={scale}
                onContextMenu={onContextMenu}
            >
                {cards.map(card => {
                    const left = card.position.x - CARD_WIDTH_PX / 2;
                    const top = card.position.y - CARD_HEIGHT_PX / 2;
                    return (
                        <Card
                            key={card.id}
                            card={card}
                            style={{
                                position: 'absolute',
                                left,
                                top,
                                transform: isTop ? 'rotate(180deg)' : undefined
                            }}
                            onContextMenu={(e) => {
                                e.stopPropagation();
                                onCardContextMenu?.(e, card);
                            }}
                            scale={scale}
                        />
                    );
                })}
            </Zone>

            {/* Placeholder Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                <span className="text-4xl font-bold uppercase tracking-widest">{player.name}</span>
            </div>
        </div>
    );
};
