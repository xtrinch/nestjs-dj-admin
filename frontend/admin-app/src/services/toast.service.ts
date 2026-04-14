export type AdminToast = {
  message: string;
  variant?: 'success' | 'error';
};

const PENDING_TOAST_KEY = 'dj-admin.pending-toast';
const TOAST_EVENT = 'dj-admin:toast';

export function queueToast(toast: AdminToast): void {
  window.sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify(toast));
}

export function showToast(toast: AdminToast): void {
  queueToast(toast);
  window.dispatchEvent(new CustomEvent<AdminToast>(TOAST_EVENT, { detail: toast }));
}

export function consumeToast(): AdminToast | null {
  const raw = window.sessionStorage.getItem(PENDING_TOAST_KEY);
  if (!raw) {
    return null;
  }

  window.sessionStorage.removeItem(PENDING_TOAST_KEY);

  try {
    return JSON.parse(raw) as AdminToast;
  } catch {
    return null;
  }
}

export function onToast(listener: (toast: AdminToast) => void): () => void {
  const handler = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    listener(event.detail as AdminToast);
  };

  window.addEventListener(TOAST_EVENT, handler);
  return () => {
    window.removeEventListener(TOAST_EVENT, handler);
  };
}
