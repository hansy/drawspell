import {
  LEGACY_BATTLEFIELD_WIDTH,
  LEGACY_BATTLEFIELD_HEIGHT,
} from "@mtg/shared/constants/geometry";
import {
  DEFAULT_CAMERA_PAN,
  battlefieldCameraKey,
  useBattlefieldCameraStore,
} from "@/store/battlefieldCameraStore";
import * as React from "react";
import { useGameStore } from "@/store/gameStore";
import { useSmoothBattlefieldCamera } from "./useSmoothBattlefieldCamera";
import { useBattlefieldZoomControls } from "./useBattlefieldZoomControls";
import {
  createBattlefieldCamera,
  clampBattlefieldZoom,
  getBattlefieldZoomLimits,
  getBattlefieldCameraPan,
  fitBattlefieldCards,
} from "@/lib/battlefieldCamera";
import type { Position } from "@mtg/shared/positions";

export function useBattlefieldCamera({
  playerId,
  width,
  height,
  reversed,
  node,
  blocked,
}: {
  playerId: string;
  width: number;
  height: number;
  reversed: boolean;
  node: HTMLDivElement | null;
  blocked?: boolean;
}) {
  const storedZoom = useGameStore((s) => s.battlefieldViewScale[playerId] ?? 1);
  const zoom = clampBattlefieldZoom(storedZoom, width, height);
  const zoomLimits = getBattlefieldZoomLimits(width, height);
  const setZoom = useGameStore((s) => s.setBattlefieldViewScale);
  const sessionId = useGameStore((s) => s.sessionId);
  const viewerId = useGameStore((s) => s.myPlayerId);
  const sharedAnchor = useGameStore(
    (s) => s.players[playerId]?.battlefieldCameraAnchor,
  );
  const epoch = useGameStore(
    (s) => s.players[playerId]?.battlefieldCameraEpoch ?? 0,
  );
  const cameraKey = battlefieldCameraKey(sessionId, viewerId, playerId, epoch);
  const storedPan = useBattlefieldCameraStore(
    (s) => s.pans[cameraKey] ?? DEFAULT_CAMERA_PAN,
  );
  const manual = useBattlefieldCameraStore((s) => Boolean(s.manual[cameraKey]));
  const pan = React.useMemo(() => {
    if (manual) return storedPan;
    const direction = reversed ? -1 : 1;
    const desiredPan = {
      x: -direction * (sharedAnchor?.x ?? 0) * LEGACY_BATTLEFIELD_WIDTH,
      y: -direction * (sharedAnchor?.y ?? 0) * LEGACY_BATTLEFIELD_HEIGHT,
    };
    return getBattlefieldCameraPan(
      createBattlefieldCamera(width, height, zoom, reversed, desiredPan),
      width,
      height,
    );
  }, [manual, storedPan, sharedAnchor, reversed, width, height, zoom]);
  const currentPan = React.useRef(pan);
  currentPan.current = pan;
  const markManual = React.useCallback(() => {
    useBattlefieldCameraStore
      .getState()
      .markManual(cameraKey, currentPan.current);
  }, [cameraKey]);
  // Remember the effective view before input switches an untouched camera to manual.
  React.useLayoutEffect(() => {
    if (!manual && (storedPan.x !== pan.x || storedPan.y !== pan.y)) {
      useBattlefieldCameraStore.getState().setPan(cameraKey, pan);
    }
  }, [manual, storedPan, pan, cameraKey]);
  const setPan = React.useCallback(
    (value: Position | ((previous: Position) => Position)) => {
      useBattlefieldCameraStore.getState().setPan(cameraKey, value);
    },
    [cameraKey],
  );
  const [isPanning, setIsPanning] = React.useState(false);
  const [touchNavigating, setTouchNavigating] = React.useState(false);
  const drag = React.useRef<{
    id: number;
    x: number;
    y: number;
    pan: Position;
  } | null>(null);
  const camera = React.useMemo(
    () => createBattlefieldCamera(width, height, zoom, reversed, pan),
    [width, height, zoom, reversed, pan],
  );
  const latest = React.useRef({ zoom, camera });
  latest.current = { zoom, camera };
  const previous = React.useRef({ zoom, camera });
  const anchor = React.useRef<Position | null>(null);
  const skipAnchor = React.useRef(false);
  // Zoom around the pointer for wheel/pinch; around the viewport center for
  // slider and keyboard. Resizing preserves the three-card default and pan.
  React.useLayoutEffect(() => {
    const old = previous.current;
    if (old.zoom !== zoom && !skipAnchor.current) {
      const point = anchor.current ?? { x: width / 2, y: height / 2 };
      const ratio = camera.scale / old.camera.scale;
      const desired = {
        ...camera,
        offset: {
          x: point.x - (point.x - old.camera.offset.x) * ratio,
          y: point.y - (point.y - old.camera.offset.y) * ratio,
        },
      };
      const next = createBattlefieldCamera(
        width,
        height,
        zoom,
        reversed,
        getBattlefieldCameraPan(desired, width, height),
      );
      setPan(getBattlefieldCameraPan(next, width, height));
    } else {
      const bounded = getBattlefieldCameraPan(camera, width, height);
      if (
        Math.abs(bounded.x - pan.x) > 0.00001 ||
        Math.abs(bounded.y - pan.y) > 0.00001
      )
        setPan(bounded);
    }
    if (storedZoom !== zoom) setZoom(playerId, zoom, true);
    skipAnchor.current = false;
    anchor.current = null;
    previous.current = { zoom, camera };
  }, [
    zoom,
    storedZoom,
    camera,
    width,
    height,
    reversed,
    pan,
    setPan,
    setZoom,
    playerId,
  ]);
  const onZoomAnchor = React.useCallback(
    (point: Position) => {
      if (!node) return;
      markManual();
      const rect = node.getBoundingClientRect();
      anchor.current = {
        x: ((point.x - rect.left) * width) / rect.width,
        y: ((point.y - rect.top) * height) / rect.height,
      };
    },
    [node, width, height, markManual],
  );
  // Keep sub-step finger movement until it reaches another fixed zoom level.
  const pinchZoom = React.useRef<number | null>(null);
  const onTouchNavigation = React.useCallback((active: boolean) => {
    pinchZoom.current = null;
    setTouchNavigating(active);
  }, []);
  const onPinch = React.useCallback(
    (gesture: { from: Position; to: Position; ratio: number }) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const local = (p: Position) => ({
        x: ((p.x - rect.left) * width) / rect.width,
        y: ((p.y - rect.top) * height) / rect.height,
      });
      const from = local(gesture.from),
        to = local(gesture.to);
      const old = latest.current;
      useBattlefieldCameraStore
        .getState()
        .markManual(
          cameraKey,
          getBattlefieldCameraPan(old.camera, width, height),
        );
      const limits = getBattlefieldZoomLimits(width, height);
      pinchZoom.current = Math.max(
        limits.min,
        Math.min(limits.max, (pinchZoom.current ?? old.zoom) * gesture.ratio),
      );
      const nextZoom = clampBattlefieldZoom(pinchZoom.current, width, height);
      const base = createBattlefieldCamera(width, height, nextZoom, reversed);
      const ratio = base.scale / old.camera.scale;
      const offset = {
        x: to.x - (from.x - old.camera.offset.x) * ratio,
        y: to.y - (from.y - old.camera.offset.y) * ratio,
      };
      skipAnchor.current = true;
      const next = createBattlefieldCamera(
        width,
        height,
        nextZoom,
        reversed,
        getBattlefieldCameraPan({ ...base, offset }, width, height),
      );
      latest.current = { zoom: nextZoom, camera: next };
      setPan(getBattlefieldCameraPan(next, width, height));
      setZoom(playerId, nextZoom);
    },
    [node, width, height, reversed, playerId, setZoom, setPan, cameraKey],
  );
  useBattlefieldZoomControls({
    playerId,
    enabled: true,
    wheelTarget: node,
    isBlocked: blocked || isPanning,
    onZoomAnchor,
    onPinch,
    onTouchNavigation,
  });
  const endPan = React.useCallback(() => {
    drag.current = null;
    setIsPanning(false);
  }, []);
  React.useEffect(() => {
    window.addEventListener("blur", endPan);
    return () => window.removeEventListener("blur", endPan);
  }, [endPan]);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      blocked ||
      event.button !== 2 ||
      (event.target as HTMLElement).closest(
        "[data-card-id], [data-camera-controls]",
      )
    )
      return false;
    event.preventDefault();
    event.stopPropagation();
    markManual();
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pan: getBattlefieldCameraPan(camera, width, height),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    return true;
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId || !node) return false;
    if ((event.buttons & 2) === 0) {
      endPan();
      return true;
    }
    const rect = node.getBoundingClientRect();
    const desiredPan = {
      x:
        start.pan.x +
        ((event.clientX - start.x) * width) / rect.width / camera.scale,
      y:
        start.pan.y +
        ((event.clientY - start.y) * height) / rect.height / camera.scale,
    };
    const next = createBattlefieldCamera(
      width,
      height,
      zoom,
      reversed,
      desiredPan,
    );
    setPan(getBattlefieldCameraPan(next, width, height));
    return true;
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return false;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    endPan();
    return true;
  };
  const reset = () => {
    skipAnchor.current = true;
    setPan({ x: 0, y: 0 });
    setZoom(playerId, 1);
  };
  const fit = (positions: Position[]) => {
    const next = fitBattlefieldCards(positions, width, height, reversed);
    skipAnchor.current = true;
    setPan(next.pan);
    setZoom(playerId, next.zoom);
  };
  const motion = useSmoothBattlefieldCamera(
    camera,
    `${cameraKey}/${width}/${height}/${reversed}`,
    !blocked && !isPanning && !touchNavigating,
  );
  return {
    camera: motion.camera,
    isAnimating: motion.isAnimating,
    zoom,
    zoomLimits,
    isPanning: isPanning || touchNavigating,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset,
    fit,
    setZoom: (value: number) =>
      setZoom(playerId, clampBattlefieldZoom(value, width, height)),
  };
}
