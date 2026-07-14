import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">About EADD</h1>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Mission</h2>
            <p>
              EADD — Elephant Autonomous Data Systems — exists to democratize data engineering.
              We believe every organization deserves production-quality data pipelines, regardless of team size or budget.
            </p>
            <p className="mt-3">
              Our AI platform works as a complete data engineering team: it designs architectures, writes production code,
              validates quality, estimates costs, and provides deployment instructions — all from a single conversation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">The Problem We Solve</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <h3 className="font-medium text-red-400 mb-2">Without EADD</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• Weeks to build a single pipeline</li>
                  <li>• R80,000+/month for a senior data engineer</li>
                  <li>• Inconsistent code quality</li>
                  <li>• No cost visibility until the bill arrives</li>
                  <li>• Legacy systems stuck with no migration path</li>
                </ul>
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <h3 className="font-medium text-green-400 mb-2">With EADD</h3>
                <ul className="space-y-1 text-sm text-gray-400">
                  <li>• Minutes to generate production pipelines</li>
                  <li>• From R0 (Free) to R899/month (Pro)</li>
                  <li>• Validated, tested, documented code</li>
                  <li>• Cost estimates before deployment</li>
                  <li>• Automated legacy migration with scoring</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Founder</h2>
            <div className="bg-[#0d1520] border border-gray-800 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold shrink-0">DN</div>
                <div>
                  <h3 className="text-lg font-bold">Daniel Ndou</h3>
                  <p className="text-sm text-blue-400 mb-2">Founder & CEO</p>
                  <p className="text-sm text-gray-400">
                    Data engineer with experience at Standard Bank, building enterprise-scale pipelines on SAS Viya,
                    Denodo, and modern cloud platforms. Created EADD to make senior-level data engineering accessible to everyone.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <a href="https://www.linkedin.com/company/elephant-autonomous-data-systems-eadd-ai-/" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-blue-400 transition">LinkedIn</a>
                    <a href="https://github.com/ndoudzivh" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-white transition">GitHub</a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Technology</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'AI', value: 'AWS Bedrock (Nova Lite)' },
                { label: 'Frontend', value: 'Next.js + Vercel' },
                { label: 'Backend', value: 'AWS Lambda' },
                { label: 'Platforms', value: '7 cloud targets' },
              ].map((item) => (
                <div key={item.label} className="bg-[#0d1520] border border-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className="text-sm font-medium">{item.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Contact</h2>
            <p className="text-sm text-gray-400">
              Email: <a href="mailto:daniel@elephantpod.ai" className="text-blue-400 hover:underline">daniel@elephantpod.ai</a>
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Based in South Africa. Serving data teams globally.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
