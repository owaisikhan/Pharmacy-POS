"use client";

// From Petrol-Pump-Management-Software app/_components/ui/PendingLink.js.
// Copy to app/_components/ui/PendingLink.js.
//
// Still useful beside the global progress bar for controls where the eye is
// on the control itself: a day-stepper arrow, a pager button, a mobile nav
// item. useLinkStatus reports the pending state of the enclosing Link, so the
// indicator has to live in a child component: that is the hook's contract.

import Link, { useLinkStatus } from "next/link";
import Spinner from "@/app/_components/ui/Spinner";

function LinkBody({ children, spinnerOnly }) {
  const { pending } = useLinkStatus();
  if (!pending) return children;
  if (spinnerOnly) return <Spinner />;
  return (
    <>
      <Spinner />
      {children}
    </>
  );
}

// spinnerOnly replaces the label entirely: right for an arrow, where a spinner
// beside a chevron would change the button's width mid-click.
export default function PendingLink({ href, children, spinnerOnly = false, ...props }) {
  return (
    <Link href={href} {...props}>
      <LinkBody spinnerOnly={spinnerOnly}>{children}</LinkBody>
    </Link>
  );
}
