import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EADD - AI That Builds Your Data Pipelines',
  description: 'Autonomous data engineering agent. Describe what you need, get production-ready pipelines for AWS, Snowflake, dbt, and Databricks in minutes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/50 bg-[#0a0f1a]/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-blue-400">EADD</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
              <Link href="/features" className="hover:text-white transition">Features</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/about" className="hover:text-white transition">About</Link>
              <Link href="/chat" className="hover:text-white transition">Chat</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Log in</Link>
              <Link href="/signup" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg transition">Sign up</Link>
            </div>
          </div>
        </nav>
        <div className="pt-14">
          {children}
        </div>
        <footer className="border-t border-gray-800 mt-20 py-10 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-gray-500">
              &copy; 2026 EADD — Elephant Autonomous Data Systems. All rights reserved.
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href="/features" className="hover:text-white transition">Features</Link>
              <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
              <Link href="/about" className="hover:text-white transition">About</Link>
              <a href="https://www.linkedin.com/company/elephant-autonomous-data-systems-eadd-ai-/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">LinkedIn</a>
              <a href="https://github.com/ndoudzivh/Elephant-Autonomous-Data-Systems-EADD-" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">GitHub</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
