import React from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react";

export type ContextMenuControllerInput = {
  x?: number;
  y?: number;
  referenceElement?: HTMLElement | VirtualElement | null;
  onClose: () => void;
  isSubmenu: boolean;
};

export const useContextMenuController = ({
  x,
  y,
  referenceElement,
  onClose,
  isSubmenu,
}: ContextMenuControllerInput) => {
  const menuRef = React.useRef<HTMLDivElement>(null);

  const anchorVirtualElement = React.useMemo<VirtualElement | null>(() => {
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

  const { refs, floatingStyles } = useFloating({
    placement: isSubmenu ? "right-start" : "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(isSubmenu ? { mainAxis: 4, alignmentAxis: -8 } : 6),
      flip({ fallbackAxisSideDirection: "start" }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const setFloating = React.useCallback(
    (node: HTMLDivElement | null) => {
      menuRef.current = node;
      refs.setFloating(node);
    },
    [refs]
  );

  React.useEffect(() => {
    if (referenceElement) {
      refs.setReference(referenceElement);
    } else if (anchorVirtualElement) {
      // Virtual references must be set via setPositionReference.
      refs.setPositionReference(anchorVirtualElement);
    }
  }, [referenceElement, anchorVirtualElement, refs]);

  React.useEffect(() => {
    const closeIfOutside = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;

      // If clicking inside any context menu (root or submenu), ignore
      const anyMenuContains = Array.from(
        document.querySelectorAll("[data-context-menu-root]")
      ).some((el) => el.contains(target));
      if (anyMenuContains) return;

      if (!isSubmenu) {
        onClose();
      }
    };

    let lastPointerDownStamp = -1;
    const handlePointerDown = (event: Event) => {
      lastPointerDownStamp = event.timeStamp;
      closeIfOutside(event);
    };
    const handleMouseDown = (event: Event) => {
      // Most browsers dispatch both pointerdown and mousedown for mouse clicks.
      if (lastPointerDownStamp >= 0 && event.timeStamp - lastPointerDownStamp < 50) {
        return;
      }
      closeIfOutside(event);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose, isSubmenu]);

  return {
    setFloating,
    floatingStyles,
  };
};

export type ContextMenuController = ReturnType<typeof useContextMenuController>;
