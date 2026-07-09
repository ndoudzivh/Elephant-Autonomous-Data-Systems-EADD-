'use client';

import { useState } from 'react';

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    const cloud = form.get('cloud') as string;

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // Register user with backend
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com'}/api/conversations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${name} - ${cloud}` }),
        }
      );

      if (res.ok) {
        setSuccess(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Could not connect to server. Please try again.');
    }

    setLoading(false);
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold mb-2">You're In!</h1>
          <p className="text-gray-400 mb-6">Your EADD account is ready. Start building your first pipeline.</p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com'}/api/health`}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-medium transition"
          >
            Open EADD Agent →
          </a>
          <p className="text-xs text-gray-500 mt-4">Free tier: 20 messages/day, 3 pipelines, 100K tokens/month</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Start Building Free</h1>
          <p className="text-gray-400">Create your EADD account — no credit card required</p>
        </div>

        <div className="bg-[#111d35] border border-gray-700 rounded-xl p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Full Name</label>
              <input
                name="name"
                type="text"
                placeholder="Daniel Ndou"
                required
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Target Cloud</label>
              <select
                name="cloud"
                className="w-full px-4 py-3 bg-[#0a1628] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">Google Cloud</option>
                <option value="snowflake">Snowflake</option>
                <option value="databricks">Databricks</option>
                <option value="on-premises">On-Premises</option>
              </select>
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-wait text-white py-3 rounded-lg font-medium transition"
            >
              {loading ? 'Creating Account...' : 'Create Free Account'}
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
