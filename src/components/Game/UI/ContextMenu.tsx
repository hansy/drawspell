import React, { useEffect, useRef } from 'react';
import { cn } from '../../../lib/utils';

export interface ContextMenuItem {
    label: string;
    action: () => void;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Adjust position to keep in viewport
    const style: React.CSSProperties = {
        top: y,
        left: x,
    };

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 overflow-hidden"
            style={style}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    className={cn(
                        "w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors",
                        item.danger ? "text-red-400 hover:bg-red-900/20" : "text-zinc-200"
                    )}
                    onClick={() => {
                        item.action();
                        onClose();
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
};
