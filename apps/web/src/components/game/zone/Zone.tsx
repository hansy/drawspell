import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { Zone as ZoneType } from '@/types';
import { cn } from '@/lib/utils';
import { BASE_CARD_HEIGHT, CARD_ASPECT_RATIO } from '@/lib/constants';
import { useDragStore } from '@/store/dragStore';

import { useGameStore } from '@/store/gameStore';
import { canMoveCard } from '@/rules/permissions';
import { ZONE_DRAG_OVERLAY_SCALE } from '@/lib/dndDragCue';
import {
    debugLog,
    isDebugEnabled,
    summarizeGhostElement,
    summarizeZoneElement,
    type DebugFlagKey,
} from '@/lib/debug';

interface ZoneProps {
    zone: ZoneType;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    layout?: 'stack' | 'fan' | 'grid' | 'free-form';
    scale?: number;
    cardScale?: number;
    cardBaseHeight?: number;
    cardBaseWidth?: number;
    mirrorY?: boolean;
    onContextMenu?: (e: React.MouseEvent) => void;
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerLeave?: (e: React.PointerEvent<HTMLDivElement>) => void;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
    innerRef?: (node: HTMLDivElement | null) => void;
    disabled?: boolean;
}

const BATTLEFIELD_DND_DEBUG_KEY: DebugFlagKey = "battlefieldDnd";

const ZoneInner: React.FC<ZoneProps> = ({ zone, className, style, children, layout = 'stack', scale = 1, cardScale = 1, cardBaseHeight, cardBaseWidth, mirrorY = false, onContextMenu, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onScroll, onMouseEnter, onMouseLeave, innerRef, disabled = false }) => {
    const myPlayerId = useGameStore((state) => state.myPlayerId);
    const viewerRole = useGameStore((state) => state.viewerRole);

    const ghostCard = useDragStore((state) => {
        if (!state.ghostCards || state.ghostCards.length !== 1) return null;
        const [ghost] = state.ghostCards;
        return ghost.zoneId === zone.id ? ghost : null;
    });

    const ghostPosition = ghostCard?.position;
    const ghostTapped = ghostCard?.tapped;
    const ghostSize = ghostCard?.size;

    const { setNodeRef, isOver } = useDroppable({
        id: zone.id,
        disabled,
        data: {
            zoneId: zone.id,
            type: zone.type,
            layout,
            scale,
            cardScale,
            cardBaseHeight,
            cardBaseWidth,
            mirrorY,
            dragOverlayScale: ZONE_DRAG_OVERLAY_SCALE,
            dragOverlayCue: "zone",
        },
    });
    const setRefs = React.useCallback((node: HTMLDivElement | null) => {
        setNodeRef(node);
        innerRef?.(node);
    }, [innerRef, setNodeRef]);

    const { active, over } = useDndContext();
    const isActiveDropTarget = Boolean(
        isOver ||
        (over &&
            (over.id === zone.id || over.data.current?.zoneId === zone.id))
    );

    React.useEffect(() => {
        if (!ghostCard) return;
        if (!isDebugEnabled(BATTLEFIELD_DND_DEBUG_KEY)) return;
        if (typeof requestAnimationFrame === "undefined") return;
        const frame = requestAnimationFrame(() => {
            debugLog(BATTLEFIELD_DND_DEBUG_KEY, "single-ghost-rendered", {
                zoneId: zone.id,
                zoneType: zone.type,
                cardId: ghostCard.cardId,
                ghostState: ghostCard,
                cardScale,
                cardBaseHeight,
                cardBaseWidth,
                ghostElement: summarizeGhostElement(ghostCard.cardId),
                zoneElement: summarizeZoneElement(zone.id),
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [
        cardBaseHeight,
        cardBaseWidth,
        cardScale,
        ghostCard,
        zone.id,
        zone.type,
    ]);

    // Optimized: only check validity when dragging over this zone
    const isValidDrop = React.useMemo(() => {
        if (disabled) return false;
        if (!active || !isActiveDropTarget) return false;

        const cardId = active.data.current?.cardId as string | undefined;
        if (!cardId) return false;

        // Get card and zone data directly from store to avoid stale references
        const state = useGameStore.getState();
        const card = state.cards[cardId];
        if (!card) return false;

        const fromZone = state.zones[card.zoneId];
        if (!fromZone) return false;

        const permission = canMoveCard({
            actorId: myPlayerId,
            role: viewerRole,
            card,
            fromZone,
            toZone: zone
        });

        return permission.allowed;
    }, [active?.id, active?.data.current?.cardId, disabled, isActiveDropTarget, myPlayerId, viewerRole, zone.id, zone.type, zone.ownerId]);

    return (
        <div
            ref={setRefs}
            data-zone-id={zone.id}
            data-zone-drop-disabled={disabled ? "true" : "false"}
            style={style}
            className={cn(
                "relative transition-colors duration-200",
                className
            )}
            onContextMenu={onContextMenu}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
            onScroll={onScroll}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {children}
            {isValidDrop && (
                <div
                    data-zone-drop-highlight
                    className="pointer-events-none absolute inset-0 z-50 rounded-[inherit] bg-indigo-400/20 ring-2 ring-inset ring-indigo-200 shadow-[inset_0_0_28px_rgba(129,140,248,0.42)]"
                />
            )}
            {ghostPosition && (() => {
                const resolvedBaseHeight = cardBaseHeight ?? BASE_CARD_HEIGHT;
                const resolvedBaseWidth = cardBaseWidth ?? resolvedBaseHeight * CARD_ASPECT_RATIO;
                const fallbackGhostWidth = resolvedBaseWidth * cardScale;
                const fallbackGhostHeight = resolvedBaseHeight * cardScale;
                const ghostWidth = ghostSize?.width ?? fallbackGhostWidth;
                const ghostHeight = ghostSize?.height ?? fallbackGhostHeight;
                const shouldRotateGhost = Boolean(ghostTapped && !ghostSize);
                return (
                    <div
                        className="absolute pointer-events-none z-20"
                        data-dnd-ghost-card-id={ghostCard.cardId}
                        data-dnd-ghost-kind="single"
                        style={{
                            width: ghostWidth,
                            height: ghostHeight,
                            left: ghostPosition.x - ghostWidth / 2,
                            top: ghostPosition.y - ghostHeight / 2,
                            transform: shouldRotateGhost ? 'rotate(90deg)' : undefined,
                            transformOrigin: 'center center'
                        }}
                    >
                        <div className="h-full w-full rounded-lg border-2 border-cyan-200 bg-cyan-300/25 shadow-[0_0_0_1px_rgba(103,232,249,0.75),0_0_24px_rgba(34,211,238,0.45)]" />
                        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100 shadow-[0_0_12px_rgba(103,232,249,0.95)]" />
                    </div>
                );
            })()}
        </div>
    );
};

export const Zone = React.memo(ZoneInner);
