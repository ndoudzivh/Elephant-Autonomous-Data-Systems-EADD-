import Link from 'next/link';

const features = [
  {
    icon: '🤖',
    title: '12 Specialized AI Agents',
    description: 'Planner, Builder, Reviewer, DevOps, Quality, Optimizer, Migration, Governance, Visualization, Observability — working as a team.',
  },
  {
    icon: '🏛️',
    title: 'Lakehouse Architecture',
    description: 'Every pipeline follows Bronze → Silver → Gold medallion pattern. Raw data preserved, transformations layered, business-ready outputs.',
  },
  {
    icon: '⚙️',
    title: 'Code Generation Engine',
    description: 'Generates production-ready PySpark, SQL, dbt, Airflow, Terraform, and CloudFormation. Complete with imports, error handling, and logging.',
  },
  {
    icon: '✅',
    title: 'Code Validation & Auto-Fix',
    description: 'Catches 50+ common mistakes (.with() → .withColumn()). Auto-fixes code before you see it. Self-healing with 3 retry attempts.',
  },
  {
    icon: '💰',
    title: 'Cost Estimates',
    description: 'Every pipeline includes monthly cost projection in ZAR and USD. Scaling forecasts at 2x, 5x, 10x growth. Optimization recommendations.',
  },
  {
    icon: '🚀',
    title: 'Deployment Instructions',
    description: 'Step-by-step deployment commands for AWS, Azure, GCP, Snowflake, Databricks. Includes rollback plans and troubleshooting.',
  },
  {
    icon: '🔐',
    title: 'Security & Governance',
    description: 'Blocks DROP/TRUNCATE. No hardcoded credentials. PII detection. Audit trail. Policy gates for production deployment.',
  },
  {
    icon: '🔁',
    title: 'Legacy Migration',
    description: 'Converts SAS, SSIS, Informatica, Talend, stored procedures to modern platforms. Confidence scoring per converted pipeline.',
  },
  {
    icon: '📊',
    title: 'Schema Intelligence',
    description: 'Auto-discovers schemas from uploaded files. Validates source-target compatibility. Detects schema drift. Infers transformations.',
  },
  {
    icon: '📁',
    title: 'File Upload & Analysis',
    description: 'Upload CSV, JSON, SQL, YAML files. Automatic profiling, schema discovery, and pipeline generation from your data.',
  },
  {
    icon: '🔗',
    title: 'Repository Connection',
    description: 'Connect GitHub or GitLab repos. Scan for existing pipelines and schemas. Analyze code for improvement opportunities.',
  },
  {
    icon: '🧠',
    title: 'Memory & Learning',
    description: 'Remembers previous pipelines, errors encountered, and your preferences. Gets better the more you use it.',
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen px-6 py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Everything you need to build <span className="text-blue-400">production pipelines</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            EADD is not a chatbot. It is a complete AI data engineering team that designs, builds, tests, and deploys.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="bg-[#0d1520] border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition">
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Supported Platforms</h2>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {['AWS', 'Azure', 'GCP', 'Snowflake', 'Databricks', 'dbt', 'Airflow', 'Kafka', 'Spark', 'Terraform'].map((p) => (
              <span key={p} className="px-4 py-2 bg-[#0d1520] border border-gray-700 rounded-lg text-sm text-gray-300">{p}</span>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href="/chat" className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-medium transition">
            Try EADD Free →
          </Link>
          <p className="mt-3 text-sm text-gray-500">No credit card required</p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-white transition">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
