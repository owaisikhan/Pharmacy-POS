"use client";

// Prints a bill's receipt through a hidden iframe, so no pop-up blocker gets
// in the way and the sale screen stays where it is. The receipt page calls
// window.print() itself once it has loaded.
export function printReceipt(saleId) {
  const old = document.getElementById("receipt-frame");
  old?.remove();
  const frame = document.createElement("iframe");
  frame.id = "receipt-frame";
  frame.title = "Receipt";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = `/receipt/${saleId}?print=1`;
  document.body.appendChild(frame);
}
