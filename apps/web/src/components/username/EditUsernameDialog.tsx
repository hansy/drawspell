import { m } from "@/paraglide/messages.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { UsernameForm } from './UsernameForm';

type EditUsernameDialogProps = {
  open: boolean;
  onClose: () => void;
  initialValue: string;
  onSubmit: (username: string) => void;
};

export function EditUsernameDialog({ open, onClose, initialValue, onSubmit }: EditUsernameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="ds-dialog-size-xs bg-zinc-950 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <DialogTitle>{m.edit_username_dialog_edit_username()}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {m.edit_username_dialog_this_updates_your_name_in_this_room_and_saves_it_for_future_games()}</DialogDescription>
        </DialogHeader>

        <UsernameForm
          key={open ? initialValue : 'closed'}
          initialValue={initialValue}
          submitLabel={m.save()}
          showCancel
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
