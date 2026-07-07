import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EADD — AI That Builds Your Data Pipelines',
  description: 'Autonomous data engineering agent. Describe what you need in plain English, get production-ready pipelines for AWS, Snowflake, dbt, and Databricks in minutes.',
  keywords: 'data engineering, AI agent, data pipelines, ETL, AWS Glue, Snowflake, dbt, Databricks, automation',
  openGraph: {
    title: 'EADD — AI That Builds Your Data Pipelines',
    description: 'Chat → Pipeline → Production. In minutes, not weeks.',
    url: 'https://eadd.ai',
    siteName: 'Elephant Autonomous Data Systems',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
