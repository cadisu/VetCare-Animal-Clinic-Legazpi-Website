/** Full-screen wait state: a still circle with the clinic logo spinning inside it. */
export function ProcessingScreen() {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-white/75"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-line">
        <img
          src="/VetCare_Logo.jpg"
          alt=""
          className="h-14 w-14 animate-spin rounded-full object-contain"
        />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
