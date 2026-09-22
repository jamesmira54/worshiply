import Link from "next/link";
export default function NotFound() {
  return (
    <main className="state-panel">
      <h1>Page not found</h1>
      <Link className="button primary" href="/songs">
        Back to songs
      </Link>
    </main>
  );
}
