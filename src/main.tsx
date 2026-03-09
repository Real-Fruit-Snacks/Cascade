import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

// Prevent scroll-through on modal overlays: when a modal is open,
// block wheel events that would leak to content behind the modal.
document.addEventListener('wheel', (e) => {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  const target = e.target as HTMLElement;
  // If the wheel target is outside the modal, block it
  if (!overlay.contains(target)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // If inside the modal, check if the target or an ancestor can scroll.
  // Block if not scrollable or if at scroll boundary (prevents scroll chaining).
  let el: HTMLElement | null = target;
  while (el && el !== overlay) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      const atTop = el.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) {
        e.preventDefault(); // at boundary, block to prevent scroll chaining
      }
      return;
    }
    el = el.parentElement;
  }
  e.preventDefault();
}, { passive: false, capture: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
