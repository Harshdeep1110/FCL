import { RegisterForm } from "@/components/RegisterForm";
import { Starball } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/motion";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Reveal className="w-full max-w-sm">
        <div className="card-surface rounded-2xl p-8 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <Starball className="h-10 w-10" />
            <div>
              <h1 className="text-2xl font-bold">
                <span className="text-brand">Join the league</span>
              </h1>
              <p className="text-sm text-muted">
                Create your account to start drafting.
              </p>
            </div>
          </div>
          <RegisterForm />
        </div>
      </Reveal>
    </main>
  );
}
