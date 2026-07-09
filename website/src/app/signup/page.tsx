import { SignUp } from '@clerk/nextjs';

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Start Building Free</h1>
          <p className="text-gray-400">Create your EADD account — no credit card required</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[#111d35] border border-gray-700 shadow-none',
            },
          }}
        />
        <div className="mt-4 text-center text-xs text-gray-500">
          Free tier: 20 messages/day, 3 pipelines, 100K tokens/month
        </div>
      </div>
    </main>
  );
}
