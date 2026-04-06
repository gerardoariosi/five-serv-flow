import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface SessionExpiredModalProps {
  open: boolean;
  onSignIn: () => void;
}

const SessionExpiredModal = ({ open, onSignIn }: SessionExpiredModalProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Session Expired</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Your session has expired for security reasons. Please sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={onSignIn}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
          >
            Sign In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionExpiredModal;
