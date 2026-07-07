import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <SignUp
      appearance={{
        elements: {
          formButtonPrimary:
            "bg-white hover:bg-zinc-200 text-black text-sm normal-case",
          card: "bg-zinc-900 border border-zinc-800 text-white",
          headerTitle: "text-white",
          headerSubtitle: "text-zinc-400",
          socialButtonsBlockButton:
            "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700",
          formFieldLabel: "text-zinc-300",
          formFieldInput:
            "bg-zinc-950 border-zinc-800 text-white focus:border-zinc-500",
          footerActionText: "text-zinc-400",
          footerActionLink: "text-white hover:text-zinc-300",
        },
      }}
    />
  );
}
