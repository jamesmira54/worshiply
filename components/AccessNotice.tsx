import Link from "next/link";

export function AccessNotice({
  message,
  href,
  label,
}: {
  message: string;
  href: string;
  label: string;
}) {
  return (
    <main className="state-panel">
      <h1>{message}</h1>
      <p>Ask your admin if something needs to change.</p>
      <Link className="button primary" href={href}>
        {label}
      </Link>
    </main>
  );
}
