import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
/**
 * "Are you sure?", with the consequence spelled out.
 *
 * `description` is required rather than optional: a confirm that only says "are
 * you sure" makes the person guess what they are confirming.
 */
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm",
  cancelLabel = "Cancel", destructive, onConfirm }: {
  trigger: React.ReactNode; title: string; description: string;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}
            className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
