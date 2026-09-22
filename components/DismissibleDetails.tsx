"use client";

import { useEffect, useRef, type ComponentProps } from "react";

export function DismissibleDetails(props: ComponentProps<"details">) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details?.classList.contains("card-menu")) return;
    const menu = details.querySelector<HTMLElement>(":scope > .menu-popover");
    const trigger = details.querySelector("summary");
    if (!menu || !trigger) return;
    const position = () => {
      if (!details.open) return;
      const margin = 12;
      const gap = 6;
      const anchor = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const left = viewport?.offsetLeft ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const availableHeight = Math.max(0, height - margin * 2);
      const below = Math.min(availableHeight, Math.max(0, top + height - anchor.bottom - gap - margin));
      const above = Math.min(availableHeight, Math.max(0, anchor.top - top - gap - margin));
      const opensAbove = menu.scrollHeight > below && above > below;
      menu.style.maxHeight = `${opensAbove ? above : below}px`;
      menu.style.maxWidth = `${width - margin * 2}px`;
      const bounds = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(left + margin, Math.min(anchor.right - bounds.width, left + width - bounds.width - margin))}px`;
      const desiredTop = opensAbove ? anchor.top - gap - bounds.height : anchor.bottom + gap;
      menu.style.top = `${Math.max(top + margin, Math.min(desiredTop, top + height - bounds.height - margin))}px`;
    };
    const observer = new ResizeObserver(position);
    observer.observe(menu);
    details.addEventListener("toggle", position);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      details.removeEventListener("toggle", position);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, []);
  useEffect(() => {
    const dismissOutside = (event: PointerEvent | FocusEvent) => {
      const details = ref.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target))
        details.open = false;
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, []);
  return <details {...props} ref={ref} />;
}
