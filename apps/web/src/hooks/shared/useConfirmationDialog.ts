import * as React from "react";

export type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export type RequestConfirmation = (request: ConfirmationRequest) => boolean;

export const useConfirmationDialog = () => {
  const pendingRef = React.useRef(false);
  const [request, setRequest] = React.useState<ConfirmationRequest | null>(null);

  const requestConfirmation = React.useCallback<RequestConfirmation>((next) => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setRequest(next);
    return true;
  }, []);

  const cancel = React.useCallback(() => {
    pendingRef.current = false;
    setRequest(null);
  }, []);

  const confirm = React.useCallback(() => {
    if (!pendingRef.current || !request) return;
    const action = request.onConfirm;
    pendingRef.current = false;
    setRequest(null);
    action();
  }, [request]);

  return {
    request,
    requestConfirmation,
    cancel,
    confirm,
  };
};
