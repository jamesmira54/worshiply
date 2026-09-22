"use client";
import { useEffect, useRef } from "react";

export function ConfirmDialog({
  title,
  children,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div>
        <h2 id="confirm-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
