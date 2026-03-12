import { useConfirmStore } from '../stores/confirm-store';
import { ConfirmDialog } from './ConfirmDialog';

export function ConfirmDialogProvider() {
  const request = useConfirmStore((s) => s.request);
  const respond = useConfirmStore((s) => s.respond);

  return (
    <ConfirmDialog
      open={request !== null}
      title={request?.title ?? ''}
      message={request?.message ?? ''}
      kind={request?.kind ?? 'info'}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      onConfirm={() => respond(true)}
      onCancel={() => respond(false)}
    />
  );
}
