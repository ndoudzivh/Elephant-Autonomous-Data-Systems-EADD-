import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Minimal top nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <span className="font-bold text-lg text-blue-400">EADD</span>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="/features" className="hover:text-white transition">Features</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/about" className="hover:text-white transition">About</Link>
          <Link href="/chat" className="hover:text-white transition">Chat</Link>
        </div>
      </nav>

      {/* Hero — original beautiful design */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
            Now in Public Beta
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            AI that builds your{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
              data pipelines
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Describe what you need in plain English. Get production-ready pipelines for
            AWS, Azure, GCP, Snowflake, dbt, Databricks, and On-Premises systems — in minutes, not weeks.
          </p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <a href="/chat" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition">
              Start Building Free →
            </a>
          </div>
          <div className="flex items-center justify-center gap-4">
            <a href="/login" className="text-sm text-gray-400 hover:text-white transition">Log in</a>
            <span className="text-gray-600">|</span>
            <a href="/signup" className="text-sm text-gray-400 hover:text-white transition">Sign up</a>
          </div>
          <p className="text-sm text-gray-500 mt-2">No credit card required. 20 messages/day free forever.</p>
          <div className="mt-16 text-gray-500 text-sm">
            Generates production code for:{' '}
            <span className="text-gray-300 font-medium">AWS | Azure | GCP | Snowflake | dbt | Databricks | On-Premises</span>
          </div>
        </div>
      </div>

      {/* Bottom links */}
      <footer className="py-6 px-6 text-center text-xs text-gray-600">
        <div className="flex items-center justify-center gap-4">
          <Link href="/features" className="hover:text-white transition">Features</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/about" className="hover:text-white transition">About</Link>
          <a href="https://www.linkedin.com/company/elephant-autonomous-data-systems-eadd-ai-/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">LinkedIn</a>
          <a href="https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a>
        </div>
        <p className="mt-2 text-gray-700">&copy; 2026 EADD — Elephant Autonomous Data Systems</p>
      </footer>
    </main>
  );
}
