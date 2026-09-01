import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Inloggen — EquiManege CMS",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <LoginForm />
    </main>
  );
}
