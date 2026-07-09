export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Start Building Free</h1>
          <p className="text-gray-400">Create your EADD account — no credit card required</p>
        </div>

        <div className="bg-[#111d35] border border-gray-700 rounded-xl p-6">
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Daniel Ndou"
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Target Cloud</label>
              <select className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500">
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">Google Cloud</option>
                <option value="snowflake">Snowflake</option>
                <option value="databricks">Databricks</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition"
            >
              Create Free Account
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-gray-500">
            Free tier: 20 messages/day, 3 pipelines, 100K tokens/month
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:underline">Log in</a>
        </p>
      </div>
    </main>
  );
}
