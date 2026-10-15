import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmDialog, DialogVariant } from '../components/ui/ConfirmDialog.js';

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  icon?: React.ReactNode;
}

export interface AlertOptions {
  title?: string;
  message: React.ReactNode;
  buttonText?: string;
  variant?: DialogVariant;
  icon?: React.ReactNode;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showAlert: (options: AlertOptions | string, title?: string, variant?: DialogVariant) => Promise<void>;
  showSuccess: (message: string, title?: string) => Promise<void>;
  showError: (message: string, title?: string) => Promise<void>;
  showWarning: (message: string, title?: string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

interface DialogState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant: DialogVariant;
  isAlertOnly: boolean;
  icon?: React.ReactNode;
}

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    isAlertOnly: false
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        isAlertOnly: false,
        icon: options.icon
      });
    });
  }, []);

  const showAlert = useCallback(
    (options: AlertOptions | string, title = 'Notice', variant: DialogVariant = 'info'): Promise<void> => {
      return new Promise<void>((resolve) => {
        resolverRef.current = () => resolve();

        if (typeof options === 'string') {
          setDialogState({
            isOpen: true,
            title,
            message: options,
            confirmText: 'Understood',
            variant,
            isAlertOnly: true
          });
        } else {
          setDialogState({
            isOpen: true,
            title: options.title || title,
            message: options.message,
            confirmText: options.buttonText || 'Understood',
            variant: options.variant || variant,
            isAlertOnly: true,
            icon: options.icon
          });
        }
      });
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, title = 'Success'): Promise<void> => {
      return showAlert(message, title, 'success');
    },
    [showAlert]
  );

  const showError = useCallback(
    (message: string, title = 'Error'): Promise<void> => {
      return showAlert(message, title, 'danger');
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (message: string, title = 'Attention Required'): Promise<void> => {
      return showAlert(message, title, 'warning');
    },
    [showAlert]
  );

  const handleConfirm = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider
      value={{
        confirm,
        showAlert,
        showSuccess,
        showError,
        showWarning
      }}
    >
      {children}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        variant={dialogState.variant}
        isAlertOnly={dialogState.isAlertOnly}
        icon={dialogState.icon}
      />
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
