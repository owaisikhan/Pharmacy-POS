// From Petrol-Pump-Management-Software app/_components/ui/Spinner.js.
// Copy to app/_components/ui/Spinner.js.
//
// The "working on it" indicator, shared so every pending state looks like the
// same thing happening. border-current takes the colour of whatever it sits
// inside, so it reads on a dark button, a light one and an input alike.
export default function Spinner({ className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
