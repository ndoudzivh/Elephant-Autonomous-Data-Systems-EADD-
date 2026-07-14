'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'free';

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = '/chat';
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-gray-400 mt-1">
            {plan !== 'free' ? `Starting with ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan` : 'Start building pipelines for free'}
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daniel Ndou"
              className="w-full px-4 py-3 bg-[#0d1520] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 bg-[#0d1520] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full px-4 py-3 bg-[#0d1520] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              required
              minLength={8}
            />
          </div>
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition">
            Create account
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link></p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-gray-600 hover:text-white transition">← Home</Link>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <SignupForm />
    </Suspense>
  );
}
