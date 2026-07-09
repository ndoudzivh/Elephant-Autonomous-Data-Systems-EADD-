import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-400">Log in to your EADD account</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-[#111d35] border border-gray-700 shadow-none',
            },
          }}
        />
      </div>
    </main>
  );
}
