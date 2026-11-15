import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
}

export const Sheet = ({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel,
}: SheetProps) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.sheetBackdrop}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.sheetHeader}>
          <h2 id={titleId} className={styles.sheetTitle}>
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.sheetClose}
            onClick={onClose}
            aria-label={closeLabel}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        {footer ? <div className={styles.sheetFooter}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
};
