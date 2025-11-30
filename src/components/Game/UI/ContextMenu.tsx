import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating, type VirtualElement, type ReferenceElement } from '@floating-ui/react';
import { cn } from '../../../lib/utils';
import { ContextMenuItem } from '../context/menu';

interface ContextMenuProps {
    x?: number;
    y?: number;
    referenceElement?: ReferenceElement | null;
    items: ContextMenuItem[];
    onClose: () => void;
    className?: string;
    title?: string;
    isSubmenu?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, referenceElement, items, onClose, className, title, isSubmenu = false }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);
    const [submenuReference, setSubmenuReference] = useState<HTMLElement | null>(null);

    const anchorVirtualElement = useMemo<VirtualElement | null>(() => {
        if (x == null || y == null) return null;
        return {
            getBoundingClientRect: () => ({
                x,
                y,
                top: y,
                left: x,
                right: x,
                bottom: y,
                width: 0,
                height: 0,
            }),
            contextElement: menuRef.current ?? undefined,
        };
    }, [x, y]);

    const { refs, floatingStyles } = useFloating<ReferenceElement>({
        placement: isSubmenu ? 'right-start' : 'bottom-start',
        strategy: 'fixed',
        middleware: [
            offset(isSubmenu ? { mainAxis: 4, alignmentAxis: -8 } : 6),
            flip({ fallbackAxisSideDirection: 'start' }),
            shift({ padding: 8 }),
        ],
        elements: {
            // The library supports virtual references; cast to appease the DOM Element constraint in TS.
            reference: (referenceElement ?? anchorVirtualElement ?? null) as Element | null,
        },
        whileElementsMounted: autoUpdate,
    });

    useEffect(() => {
        refs.setReference((referenceElement ?? anchorVirtualElement ?? null) as Element | null);
    }, [referenceElement, anchorVirtualElement, refs]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target) return;

            // If clicking inside any context menu (root or submenu), ignore
            const anyMenuContains = Array.from(document.querySelectorAll('[data-context-menu-root]')).some((el) =>
                el.contains(target)
            );
            if (anyMenuContains) return;

            if (!isSubmenu) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, isSubmenu]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isSubmenu) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose, isSubmenu]);

    const handleMouseEnter = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
        const item = items[index];
        if (item.type === 'action' && item.submenu) {
            setActiveSubmenuIndex(index);
            setSubmenuReference(e.currentTarget);
        } else {
            setActiveSubmenuIndex(null);
            setSubmenuReference(null);
        }
    };

    return (
        <FloatingPortal>
            <div
                ref={(node) => {
                    menuRef.current = node;
                    refs.setFloating(node);
                }}
                data-context-menu-root
                className={cn(
                    "z-[10000] pointer-events-auto min-w-[160px] max-w-[280px] max-h-[70vh] overflow-auto bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1",
                    className
                )}
                style={floatingStyles}
            >
                {title && (
                    <div className="px-4 py-2 border-b border-zinc-700 mb-1">
                        <div className="font-semibold text-sm text-zinc-100 truncate max-w-[200px]">{title}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Actions:</div>
                    </div>
                )}
                {items.map((item, index) => {
                    if (item.type === 'separator') {
                        return <div key={item.id ?? index} className="h-px bg-zinc-700 my-1 mx-2" />;
                    }

                    const isDisabled = Boolean(item.disabledReason);
                    return (
                        <React.Fragment key={index}>
                            <button
                                className={cn(
                                    "w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group",
                                    item.danger ? "text-red-400 hover:bg-red-900/20" : "text-zinc-200",
                                    activeSubmenuIndex === index && "bg-zinc-700",
                                    !isDisabled && "hover:bg-zinc-700",
                                    isDisabled && "opacity-60 cursor-not-allowed"
                                )}
                                onClick={() => {
                                    if (isDisabled) return;
                                    if (!item.submenu) {
                                        item.onSelect();
                                        onClose(); // Close all menus
                                    }
                                }}
                                onMouseEnter={(e) => handleMouseEnter(index, e)}
                                title={item.disabledReason}
                                disabled={isDisabled}
                            >
                                <span>{item.label}</span>
                                {item.submenu && <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />}
                            </button>

                            {/* Render Submenu */}
                            {item.submenu && activeSubmenuIndex === index && submenuReference && (
                                <ContextMenu
                                    referenceElement={submenuReference}
                                    items={item.submenu}
                                    onClose={onClose}
                                    isSubmenu={true}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </FloatingPortal>
    );
};

export type { ContextMenuItem } from '../context/menu';
