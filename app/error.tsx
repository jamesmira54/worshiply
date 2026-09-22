"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="state-panel">
      <h1>Something interrupted the music.</h1>
      <p>Please try again. Your saved songs are still in the library.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
