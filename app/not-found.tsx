import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl">🦉❓</div>
      <h1 className="mt-4 text-3xl font-semibold">Ollie can&apos;t find that page</h1>
      <Link href="/" className="mt-6 rounded-2xl bg-brand-500 px-6 py-3 font-display font-semibold text-white shadow-pop">
        Back to the studio
      </Link>
    </div>
  );
}
