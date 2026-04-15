export type ContextMenuItem =
  | ContextMenuAction
  | ContextMenuSeparator
  | ContextMenuLabel
  | ContextMenuCounterControl;

export interface ContextMenuAction {
  type: "action";
  label: string;
  onSelect: () => void;
  closeOnSelect?: boolean;
  danger?: boolean;
  submenu?: ContextMenuItem[];
  disabledReason?: string;
  shortcut?: string;
  checked?: boolean;
}

export interface ContextMenuSeparator {
  type: "separator";
  id?: string;
}

export interface ContextMenuLabel {
  type: "label";
  label: string;
}

export interface ContextMenuCounterControl {
  type: "counter-control";
  label: string;
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}
