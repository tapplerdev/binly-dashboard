import Image from 'next/image';
import { LoginForm } from '@/components/binly/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          {/* Elevated Card Container */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 space-y-8 border border-gray-100">
            {/* Logo */}
            <div>
              <h1
                className="text-4xl font-bold leading-none"
                style={{
                  background: 'linear-gradient(to right, #5E9646, #4AA0B5)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                BINLY
              </h1>
            </div>

            {/* Login Form */}
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right Panel - Background Image */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-[#B8CCC4] to-[#A8BDB5]">
        <Image
          src="/login-background.png"
          alt="Binly Command Center"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
}
