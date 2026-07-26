export default function LatticePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-24">
      <h1 className="text-4xl font-bold text-text-primary">Lattice</h1>
      <p className="mt-4 text-text-secondary">GPU / knowledge graph / visual system.</p>
      {/* The interactive canvas will be mounted here via @substrate/graphics */}
      <div id="lattice-canvas" className="mt-12 h-[600px] w-full" />
    </main>
  );
}
