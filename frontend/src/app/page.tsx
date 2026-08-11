import Counter from '@/components/counter';

export default function Home() {
  const serverTime = new Date().toISOString();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-4xl font-bold">Hello CyGRC M1</h1>
      <p className="text-sm text-gray-500">
        Rendered on the server at: {serverTime}
      </p>
      <Counter />
    </main>
  );
}
