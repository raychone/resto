import { Suspense } from "react";
import ClientSignupClient from "./signup-client";

export default function ClientSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <ClientSignupClient />
    </Suspense>
  );
}
