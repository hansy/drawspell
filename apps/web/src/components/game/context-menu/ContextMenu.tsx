import React from "react";
import { FloatingTree } from "@floating-ui/react";

import type { ContextMenuItem } from "@/models/game/context-menu/menu";

import { ContextMenuView } from "./ContextMenuView";
import { useContextMenuController } from "@/hooks/game/context-menu/useContextMenuController";

export interface ContextMenuProps {
  x?: number;
  y?: number;
  referenceElement?: HTMLElement | import("@floating-ui/react").VirtualElement | null;
  items: ContextMenuItem[];
  onClose: () => void;
  className?: string;
  title?: string;
  isSubmenu?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  referenceElement,
  items,
  onClose,
  className,
  title,
  isSubmenu = false,
}) => {
  const controller = useContextMenuController({
    x,
    y,
    referenceElement,
    onClose,
    isSubmenu,
  });

  const handleItemClick = React.useCallback(
    (item: ContextMenuItem) => {
      if (item.type !== "action") return;
      if (item.submenu) return;
      item.onSelect();
      if (item.closeOnSelect !== false) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <FloatingTree>
      <ContextMenuView
        setFloating={controller.setFloating}
        floatingStyles={controller.floatingStyles}
        items={items}
        className={className}
        title={title}
        onItemClick={handleItemClick}
      />
    </FloatingTree>
  );
};

export type { ContextMenuItem } from "@/models/game/context-menu/menu";
