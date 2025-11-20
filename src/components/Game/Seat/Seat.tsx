import React from 'react';
import { cn } from '../../../lib/utils';
import { Player, Zone as ZoneType, Card as CardType, ZoneId } from '../../../types';
import { Card } from '../Card/Card';
import { Zone } from '../Zone/Zone';
import { LifeBox } from '../Player/LifeBox';
import { Hand } from './Hand';
import { Battlefield } from './Battlefield';
import { Button } from '../../ui/button';
import { Plus } from 'lucide-react';

interface SeatProps {
    player: Player;
    position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    color: string;
    zones: Record<string, ZoneType>;
    cards: Record<string, CardType>;
    isMe: boolean;
    scale?: number;
    className?: string;
    onCardContextMenu?: (e: React.MouseEvent, card: CardType) => void;
    onZoneContextMenu?: (e: React.MouseEvent, zoneId: ZoneId) => void;
    onLoadDeck?: () => void;
    ghostCard?: { zoneId: string; position: { x: number; y: number }; tapped?: boolean } | null;
    opponentColors: Record<string, string>;
}

export const Seat: React.FC<SeatProps> = ({
    player,
    position,
    color,
    zones,
    cards,
    isMe,
    scale = 1,
    className,
    onCardContextMenu,
    onZoneContextMenu,
    onLoadDeck,
    ghostCard,
    opponentColors
}) => {
    const isTop = position.startsWith('top');
    const isRight = position.endsWith('right');

    // Find zones for this player
    const findZone = (type: string) => Object.values(zones).find(z => z.ownerId === player.id && z.type === type);

    const handZone = findZone('hand');
    const libraryZone = findZone('library');
    const graveyardZone = findZone('graveyard');
    const exileZone = findZone('exile');
    const battlefieldZone = findZone('battlefield');

    // Helper to get cards
    const getCards = (zone?: ZoneType) => zone ? zone.cardIds.map(id => cards[id]).filter(Boolean) : [];

    const inverseScale = 1 / scale * 100;

    return (
        <div className={cn(
            "relative w-full h-full border-zinc-800",
            // Add borders based on position to create the grid lines
            position === 'bottom-left' && "border-r border-t",
            position === 'bottom-right' && "border-l border-t",
            position === 'top-left' && "border-r border-b",
            position === 'top-right' && "border-l border-b",
            // Background tint
            `bg-${color}-950/10`,
            className
        )}>
            {/* Scaled Wrapper */}
            <div
                className={cn(
                    "flex w-full h-full",
                    isRight && "flex-row-reverse" // If on right, flip so sidebar is on right (edge)
                )}
                style={{
                    width: `${inverseScale}%`,
                    height: `${inverseScale}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                }}
            >
                {/* Sidebar */}
                <div className={cn(
                    "w-40 bg-zinc-900/50 flex flex-col p-4 shrink-0 z-10 items-center border-zinc-800/50 h-full justify-between",
                    isRight ? "border-l" : "border-r" // Border faces the content
                )}>
                    {/* Player HUD (Life) */}
                    <div className={cn("w-full flex justify-center", isTop && "order-last")}>
                        <LifeBox player={player} isMe={isMe} className="origin-center" opponentColors={opponentColors} />
                    </div>

                    {/* Zones */}
                    <div className={cn("flex flex-col gap-10 w-full items-center flex-1 justify-center", isTop && "flex-col-reverse")}>
                        {/* Library */}
                        {libraryZone && (
                            <div
                                className="relative group"
                                onContextMenu={(e) => onZoneContextMenu?.(e, libraryZone.id)}
                            >
                                <Zone zone={libraryZone} className="w-32 h-24 bg-zinc-800/30 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center relative cursor-context-menu">
                                    {libraryZone.cardIds.length > 0 ? (
                                        <div className="w-24 h-32 rotate-90">
                                            <Card card={getCards(libraryZone)[0]} faceDown className="w-full h-full pointer-events-none" />
                                        </div>
                                    ) : (
                                        isMe && onLoadDeck ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={onLoadDeck}
                                                className="h-full w-full flex flex-col gap-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                            >
                                                <Plus size={20} />
                                                <span className="text-[10px] font-medium">Load Deck</span>
                                            </Button>
                                        ) : (
                                            <span className="text-zinc-600 text-xs">Empty</span>
                                        )
                                    )}

                                    {/* Overlay Info */}
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold whitespace-nowrap border border-zinc-800 rounded-full z-10",
                                        isTop ? "-bottom-3" : "-top-3"
                                    )}>
                                        Library
                                    </div>
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-xs text-zinc-300 font-mono border border-zinc-800 rounded-full z-10",
                                        isTop ? "-top-3" : "-bottom-3"
                                    )}>
                                        {libraryZone.cardIds.length}
                                    </div>
                                </Zone>
                            </div>
                        )}

                        {/* Graveyard */}
                        {graveyardZone && (
                            <div
                                className="relative group"
                                onContextMenu={(e) => onZoneContextMenu?.(e, graveyardZone.id)}
                            >
                                <Zone zone={graveyardZone} className="w-32 h-24 bg-zinc-800/30 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center relative">
                                    {graveyardZone.cardIds.length > 0 ? (
                                        <div className="w-24 h-32 rotate-90">
                                            <Card card={getCards(graveyardZone)[getCards(graveyardZone).length - 1]} className="w-full h-full pointer-events-none" />
                                        </div>
                                    ) : (
                                        <span className="text-zinc-600 text-xs">Empty</span>
                                    )}

                                    {/* Overlay Info */}
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold whitespace-nowrap border border-zinc-800 rounded-full z-10",
                                        isTop ? "-bottom-3" : "-top-3"
                                    )}>
                                        Graveyard
                                    </div>
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-xs text-zinc-300 font-mono border border-zinc-800 rounded-full z-10",
                                        isTop ? "-top-3" : "-bottom-3"
                                    )}>
                                        {graveyardZone.cardIds.length}
                                    </div>
                                </Zone>
                            </div>
                        )}

                        {/* Exile */}
                        {exileZone && (
                            <div
                                className="relative group"
                                onContextMenu={(e) => onZoneContextMenu?.(e, exileZone.id)}
                            >
                                <Zone zone={exileZone} className="w-32 h-24 bg-zinc-800/30 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center relative">
                                    {exileZone.cardIds.length > 0 ? (
                                        <div className="w-24 h-32 rotate-90">
                                            <Card card={getCards(exileZone)[getCards(exileZone).length - 1]} className="w-full h-full pointer-events-none opacity-60 grayscale" />
                                        </div>
                                    ) : (
                                        <span className="text-zinc-600 text-xs">Empty</span>
                                    )}

                                    {/* Overlay Info */}
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold whitespace-nowrap border border-zinc-800 rounded-full z-10",
                                        isTop ? "-bottom-3" : "-top-3"
                                    )}>
                                        Exile
                                    </div>
                                    <div className={cn(
                                        "absolute left-1/2 -translate-x-1/2 bg-zinc-900 px-2 text-xs text-zinc-300 font-mono border border-zinc-800 rounded-full z-10",
                                        isTop ? "-top-3" : "-bottom-3"
                                    )}>
                                        {exileZone.cardIds.length}
                                    </div>
                                </Zone>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Area */}
                <div className="flex-1 relative flex flex-col">
                    {battlefieldZone && (
                        <Battlefield
                            zone={battlefieldZone}
                            cards={getCards(battlefieldZone)}
                            player={player}
                            isTop={isTop}
                            scale={scale}
                            ghostCard={ghostCard}
                            onCardContextMenu={onCardContextMenu}
                        />
                    )}

                    {handZone && (
                        <Hand
                            zone={handZone}
                            cards={getCards(handZone)}
                            isTop={isTop}
                            isMe={isMe}
                            onCardContextMenu={onCardContextMenu}
                        />
                    )}
                </div>
                {/* Player Name Label */}
                <div className={cn(
                    "absolute z-30 bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-300 border border-zinc-700 rounded-full shadow-md",
                    isTop ? "top-[calc(6rem-13px)]" : "bottom-[calc(6rem-13px)]", // Positioned on the border of the hand (h-24 = 6rem)
                    isRight ? "right-44" : "left-44" // 40px (w-40 = 10rem) + 16px (gap) = approx left-44
                )}>
                    {player.name}
                </div>
            </div>
        </div>
    );
};

