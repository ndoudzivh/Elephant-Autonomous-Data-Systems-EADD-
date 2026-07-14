'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, redirect to chat
    window.location.href = '/chat';
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your EADD account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Email</label>
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
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-[#0d1520] border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition">
            Sign in
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Don&apos;t have an account? <Link href="/signup" className="text-blue-400 hover:underline">Sign up</Link></p>
          <p className="mt-2"><Link href="/chat" className="text-gray-500 hover:text-white">Skip — use free without account</Link></p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-gray-600 hover:text-white transition">← Home</Link>
        </div>
      </div>
    </main>
  );
}
