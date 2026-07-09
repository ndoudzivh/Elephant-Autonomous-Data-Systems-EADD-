export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a href="/signup" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition">
            Start Building Free →
          </a>
        </div>
        <p className="text-sm text-gray-500">No credit card required. 20 messages/day free forever.</p>
        <div className="mt-16 text-gray-500 text-sm">
          Generates production code for:{' '}
          <span className="text-gray-300 font-medium">AWS | Azure | GCP | Snowflake | dbt | Databricks | On-Premises</span>
        </div>
      </div>
    </main>
  );
}
