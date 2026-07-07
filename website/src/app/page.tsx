'use client';

import { useState } from 'react';
import {
  ArrowRight, Check, Database, GitBranch, Shield, Zap,
  Cloud, Code, BarChart3, Lock, Play, Star, ChevronRight,
  MessageSquare, Cpu, Layers, Terminal, Sparkles
} from 'lucide-react';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0a1628]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Database className="h-4 w-4 text-blue-400" />
            </div>
            <span className="font-bold text-lg">EADD</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-gray-400 hover:text-white transition">Log in</a>
            <a href="/signup" className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition">
              Start Free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8">
            <Sparkles className="h-3 w-3" />
            Now in Public Beta — Free to Start
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            AI that builds your<br />
            <span className="gradient-text">data pipelines</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Describe what you need in plain English. Get production-ready pipelines for
            AWS, Snowflake, dbt, and Databricks — in minutes, not weeks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <a href="/signup" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition shadow-lg shadow-blue-600/20">
              Start Building Free <ArrowRight className="h-5 w-5" />
            </a>
            <a href="#demo" className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 px-8 py-4 rounded-xl text-lg transition">
              <Play className="h-5 w-5" /> Watch Demo
            </a>
          </div>

          <p className="text-sm text-gray-500">No credit card required. 20 messages/day free forever.</p>
        </div>

        {/* Hero Visual - Chat Interface Mock */}
        <div className="max-w-4xl mx-auto mt-16">
          <div className="rounded-2xl border border-white/10 bg-[#111d35] overflow-hidden glow">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
              <span className="ml-3 text-xs text-gray-500">EADD Agent</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-end">
                <div className="bg-blue-600/20 border border-blue-500/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-md">
                  <p className="text-sm">Build me a pipeline that ingests from PostgreSQL, deduplicates on customer_id, and loads into S3 as Delta format with daily partitioning</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 max-w-lg">
                  <p className="text-sm text-gray-300 mb-3">I'll build that for you. Here's your pipeline spec:</p>
                  <div className="bg-black/30 rounded-lg p-3 font-mono text-xs text-green-400">
                    <pre>{`name: customer-pipeline
source:
  type: postgres
  incremental: timestamp
layers:
  - layer: silver
    dedup: {columns: [customer_id]}
  - layer: gold
    format: delta
    partitioning: {columns: [date]}`}</pre>
                  </div>
                  <p className="text-sm text-gray-300 mt-3">Generating AWS Glue ETL code, Terraform, and Airflow DAG...</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Glue ETL</span>
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Terraform</span>
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">Airflow DAG</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / Cloud Support */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500 mb-6">Generates production code for</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-gray-400">
            <span className="text-lg font-semibold">AWS</span>
            <span className="text-lg font-semibold">Azure</span>
            <span className="text-lg font-semibold">Snowflake</span>
            <span className="text-lg font-semibold">dbt</span>
            <span className="text-lg font-semibold">Databricks</span>
            <span className="text-lg font-semibold">Airflow</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything a data engineer builds — automated</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">From source discovery to production deployment, our AI handles the full pipeline lifecycle.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Terminal, title: 'Pipeline Generation', desc: 'Bronze → Silver → Gold layers with incremental loading, dedup, and schema enforcement.' },
              { icon: Layers, title: 'Multi-Cloud Compilation', desc: 'One YAML spec compiles to AWS Glue, Snowflake SQL, dbt models, or Databricks Delta Live Tables.' },
              { icon: GitBranch, title: 'Source-to-Target Mapping', desc: 'Auto-maps columns between source and target with fuzzy matching and confidence scoring.' },
              { icon: Shield, title: 'Data Quality Engine', desc: 'Auto-generates null, unique, range, pattern, and freshness checks with quarantine routing.' },
              { icon: Code, title: 'CI/CD Generation', desc: 'GitHub Actions and GitLab CI pipelines generated with proper environment separation.' },
              { icon: Lock, title: 'Enterprise Security', desc: 'AI never sees row-level data. Only schemas and metadata. Production requires human approval.' },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border border-white/5 bg-white/[0.02] card-hover">
                <feature.icon className="h-8 w-8 text-blue-400 mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-[#0d1a2e]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-gray-400 text-lg">From chat to production in 5 minutes</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Describe', desc: 'Tell the agent what pipeline you need in plain English' },
              { step: '2', title: 'Generate', desc: 'AI creates YAML spec + cloud-specific code + infrastructure' },
              { step: '3', title: 'Test', desc: 'Pipeline auto-runs in sandbox with sample data' },
              { step: '4', title: 'Deploy', desc: 'You review and approve. One click to production.' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4 text-blue-400 font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg mb-6">Start free. Upgrade when you need more.</p>
            <div className="inline-flex items-center bg-white/5 rounded-lg p-1">
              <button onClick={() => setBillingCycle('monthly')} className={`px-4 py-2 rounded-md text-sm transition ${billingCycle === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-4 py-2 rounded-md text-sm transition ${billingCycle === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Annual <span className="text-green-400 text-xs ml-1">-20%</span></button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h3 className="font-semibold text-lg mb-1">Free</h3>
              <p className="text-gray-400 text-sm mb-4">For learning and personal projects</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-gray-400">/month</span>
              </div>
              <a href="/signup" className="block text-center border border-white/20 hover:border-white/40 py-3 rounded-lg text-sm font-medium transition mb-6">Get Started</a>
              <ul className="space-y-3 text-sm text-gray-300">
                {['20 messages/day', '3 pipelines', 'AWS backend only', '100K tokens/month', 'Community support', 'Code export'].map(f => (
                  <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
            </div>

            {/* Pro - highlighted */}
            <div className="p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-xs font-medium rounded-full">Most Popular</div>
              <h3 className="font-semibold text-lg mb-1">Pro</h3>
              <p className="text-gray-400 text-sm mb-4">For professional data engineers</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">${billingCycle === 'monthly' ? '49' : '39'}</span>
                <span className="text-gray-400">/month</span>
                {billingCycle === 'annual' && <span className="text-green-400 text-xs ml-2">billed annually</span>}
              </div>
              <a href="/signup?plan=pro" className="block text-center bg-blue-600 hover:bg-blue-500 py-3 rounded-lg text-sm font-medium transition mb-6">Start 14-Day Trial</a>
              <ul className="space-y-3 text-sm text-gray-300">
                {['500 messages/day', '50 pipelines', 'All 5 cloud backends', '2M tokens/month included', 'All data model styles', 'Schema drift detection', 'Full quality engine', 'Git integration', 'API access', 'Email support'].map(f => (
                  <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
            </div>

            {/* Team */}
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h3 className="font-semibold text-lg mb-1">Team</h3>
              <p className="text-gray-400 text-sm mb-4">For data engineering teams</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">${billingCycle === 'monthly' ? '29' : '23'}</span>
                <span className="text-gray-400">/user/month</span>
              </div>
              <a href="/signup?plan=team" className="block text-center border border-white/20 hover:border-white/40 py-3 rounded-lg text-sm font-medium transition mb-6">Contact Sales</a>
              <ul className="space-y-3 text-sm text-gray-300">
                {['Everything in Pro', 'Up to 25 team members', 'Shared workspaces', 'SSO / SAML', 'Audit logs', 'Priority support', 'Custom domain', 'GDPR compliance'].map(f => (
                  <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-gray-400 text-sm">
              Need enterprise? VPC deployment, SLA, and compliance (POPIA, SOX, PCI-DSS)?{' '}
              <a href="mailto:enterprise@eadd.ai" className="text-blue-400 hover:underline">Talk to us</a>
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#0d1a2e] to-[#0a1628]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to stop writing boilerplate?</h2>
          <p className="text-gray-400 text-lg mb-8">Join 100+ data engineers building pipelines 100x faster.</p>
          <a href="/signup" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition shadow-lg shadow-blue-600/20">
            Start Building Free <ArrowRight className="h-5 w-5" />
          </a>
          <p className="text-sm text-gray-500 mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-blue-400" />
            <span className="font-semibold">Elephant Autonomous Data Systems</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="/privacy" className="hover:text-white transition">Privacy</a>
            <a href="/terms" className="hover:text-white transition">Terms</a>
            <a href="mailto:info@eadd.ai" className="hover:text-white transition">Contact</a>
            <a href="https://linkedin.com/company/eadd-ai" className="hover:text-white transition">LinkedIn</a>
          </div>
          <p className="text-xs text-gray-500">2026 EADD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
