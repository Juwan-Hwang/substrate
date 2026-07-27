import Link from 'next/link';

const SUBSYSTEMS = [
  { name: 'Lattice', href: '/lattice', description: 'GPU / knowledge graph / visual system' },
  { name: 'Crucible', href: '/crucible', description: 'Runnable experiments / benchmark lab' },
  { name: 'Archive', href: '/archive', description: 'Articles / projects / notes' },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-24">
      <header className="mb-20">
        <h1 className="text-5xl font-bold tracking-tight text-text-primary">Aevum</h1>
        <p className="mt-4 text-lg text-text-secondary">
          A personal site platform — built on Substrate.
        </p>
      </header>

      <nav className="grid gap-6 sm:grid-cols-3">
        {SUBSYSTEMS.map((s) => (
          <Link
            key={s.name}
            href={s.href}
            className="aevum-glass-card group p-6 transition-all hover:scale-[1.02]"
          >
            <h2 className="text-xl font-semibold text-text-primary">{s.name}</h2>
            <p className="mt-2 text-sm text-text-secondary">{s.description}</p>
          </Link>
        ))}
      </nav>
    </main>
  );
}
