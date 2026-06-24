import type { TouchEvent as ReactTouchEvent } from "react";
import type {
  SensorInstance,
  SensorProps,
  TouchSensorOptions,
} from "@dnd-kit/core";

export const TOUCH_DRAG_PRIME_DELAY_MS = 750;
export const TOUCH_CONTEXT_MENU_LONG_PRESS_MS = 1400;
const TOUCH_CONTEXT_MENU_SENSOR_CLEANUP_GRACE_MS = 100;
export const TOUCH_SCROLL_CANCEL_DISTANCE_PX = 12;
export const TOUCH_DRAG_ACTIVATION_DISTANCE_PX = 4;

type Point = { x: number; y: number };

type PrimedTouchSensorOptions = TouchSensorOptions & {
  primeDelayMs?: number;
  contextMenuDelayMs?: number;
  scrollCancelDistancePx?: number;
  activationDistancePx?: number;
};

type ListenerRecord = {
  target: EventTarget;
  type: string;
  handler: EventListener;
  options?: AddEventListenerOptions | boolean;
};

export const getTouchPoint = (event: TouchEvent): Point | null => {
  const touch = event.touches[0] ?? event.changedTouches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
};

export const distanceBetween = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export type PrimedTouchMoveDecision = "pending" | "cancel" | "start";

export const decidePrimedTouchMove = (params: {
  elapsedMs: number;
  movementPx: number;
  primeDelayMs?: number;
  contextMenuDelayMs?: number;
  scrollCancelDistancePx?: number;
  activationDistancePx?: number;
}): PrimedTouchMoveDecision => {
  const primeDelayMs = params.primeDelayMs ?? TOUCH_DRAG_PRIME_DELAY_MS;
  const contextMenuDelayMs =
    params.contextMenuDelayMs ?? TOUCH_CONTEXT_MENU_LONG_PRESS_MS;
  const scrollCancelDistancePx =
    params.scrollCancelDistancePx ?? TOUCH_SCROLL_CANCEL_DISTANCE_PX;
  const activationDistancePx =
    params.activationDistancePx ?? TOUCH_DRAG_ACTIVATION_DISTANCE_PX;

  if (params.elapsedMs >= contextMenuDelayMs) return "cancel";
  if (params.elapsedMs < primeDelayMs) {
    return params.movementPx > scrollCancelDistancePx ? "cancel" : "pending";
  }
  return params.movementPx > activationDistancePx ? "start" : "pending";
};

export class PrimedTouchSensor implements SensorInstance {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        { nativeEvent: event }: ReactTouchEvent,
        { onActivation }: PrimedTouchSensorOptions
      ) => {
        if (event.touches.length > 1) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];

  static setup() {
    const noop = () => {};
    window.addEventListener("touchmove", noop, { passive: false });
    return () => window.removeEventListener("touchmove", noop);
  }

  autoScrollEnabled = true;

  private readonly props: SensorProps<PrimedTouchSensorOptions>;
  private readonly listeners: ListenerRecord[] = [];
  private readonly startPoint: Point | null;
  private readonly startTime = Date.now();
  private activated = false;
  private contextMenuTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: SensorProps<PrimedTouchSensorOptions>) {
    this.props = props;
    this.startPoint =
      props.event instanceof TouchEvent ? getTouchPoint(props.event) : null;
    this.attach();
  }

  private addListener(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean
  ) {
    target.addEventListener(type, handler, options);
    this.listeners.push({ target, type, handler, options });
  }

  private attach() {
    const target = this.getEventTarget();
    const win = this.getWindow();
    const doc = this.getDocument();

    this.addListener(target, "touchmove", this.handleMove, { passive: false });
    this.addListener(target, "touchend", this.handleEnd);
    this.addListener(target, "touchcancel", this.handleCancel);
    this.addListener(win, "resize", this.handleCancel);
    this.addListener(win, "dragstart", this.preventDefault);
    this.addListener(win, "visibilitychange", this.handleCancel);
    this.addListener(win, "contextmenu", this.preventDefault);
    this.addListener(doc, "keydown", this.handleKeydown);

    const contextMenuDelayMs =
      this.props.options.contextMenuDelayMs ?? TOUCH_CONTEXT_MENU_LONG_PRESS_MS;
    this.contextMenuTimeoutId = setTimeout(
      () => this.cancelPending(),
      contextMenuDelayMs + TOUCH_CONTEXT_MENU_SENSOR_CLEANUP_GRACE_MS
    );
  }

  private detach() {
    this.listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this.listeners.length = 0;
    if (this.contextMenuTimeoutId) {
      clearTimeout(this.contextMenuTimeoutId);
      this.contextMenuTimeoutId = null;
    }
  }

  private getEventTarget() {
    const target = this.props.event.target;
    return target instanceof EventTarget ? target : this.getDocument();
  }

  private getDocument() {
    const target = this.props.event.target;
    return target instanceof Node ? target.ownerDocument ?? document : document;
  }

  private getWindow() {
    return this.getDocument().defaultView ?? window;
  }

  private startDrag(coordinates: Point, event: TouchEvent) {
    if (this.activated) return;
    this.activated = true;
    this.props.onStart(this.startPoint ?? coordinates);
    if (event.cancelable) event.preventDefault();
    this.props.onMove(coordinates);
  }

  private cancelPending() {
    if (this.activated) return;
    this.detach();
    this.props.onAbort(this.props.active);
    this.props.onCancel();
  }

  private handleMove = (event: Event) => {
    if (!(event instanceof TouchEvent) || !this.startPoint) return;
    const coordinates = getTouchPoint(event);
    if (!coordinates) return;

    if (!this.activated) {
      const movementPx = distanceBetween(this.startPoint, coordinates);
      const decision = decidePrimedTouchMove({
        elapsedMs: Date.now() - this.startTime,
        movementPx,
        primeDelayMs: this.props.options.primeDelayMs,
        contextMenuDelayMs: this.props.options.contextMenuDelayMs,
        scrollCancelDistancePx: this.props.options.scrollCancelDistancePx,
        activationDistancePx: this.props.options.activationDistancePx,
      });

      if (decision === "cancel") {
        this.cancelPending();
        return;
      }
      if (decision === "pending") return;
      this.startDrag(coordinates, event);
      return;
    }

    if (event.cancelable) event.preventDefault();
    this.props.onMove(coordinates);
  };

  private handleEnd = () => {
    this.detach();
    if (!this.activated) {
      this.props.onAbort(this.props.active);
    }
    this.props.onEnd();
  };

  private handleCancel = () => {
    this.detach();
    if (!this.activated) {
      this.props.onAbort(this.props.active);
    }
    this.props.onCancel();
  };

  private handleKeydown = (event: Event) => {
    if (event instanceof KeyboardEvent && event.code === "Escape") {
      this.handleCancel();
    }
  };

  private preventDefault = (event: Event) => {
    event.preventDefault();
  };
}
