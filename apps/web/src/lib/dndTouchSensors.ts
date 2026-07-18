import {
  TouchSensor,
  type DraggableNode,
  type PointerActivationConstraint,
} from "@dnd-kit/core";

export type TouchDragActivationMode = "direct" | "vertical";

export const getTouchDragActivationMode = (
  activeNode: Pick<DraggableNode, "data">,
): TouchDragActivationMode =>
  activeNode.data.current?.touchDragActivation === "vertical"
    ? "vertical"
    : "direct";

export const getTouchDragActivationConstraint = (
  mode: TouchDragActivationMode,
): PointerActivationConstraint =>
  mode === "vertical" ? { distance: { y: 6 } } : { distance: 4 };

type TouchSensorConstructorProps = ConstructorParameters<typeof TouchSensor>[0];

export class RoutedTouchSensor extends TouchSensor {
  constructor(props: TouchSensorConstructorProps) {
    const mode = getTouchDragActivationMode(props.activeNode);
    super({
      ...props,
      options: {
        ...props.options,
        activationConstraint: getTouchDragActivationConstraint(mode),
      },
    });
  }
}
