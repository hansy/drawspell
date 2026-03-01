import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" updatedAt="March 1, 2026">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">
          Information We Collect
        </h2>
        <p>
          We collect minimal technical data needed to run Drawspell, such as
          browser details, session IDs, and basic analytics events.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">
          How We Use Information
        </h2>
        <p>
          We use data to operate the service, improve reliability, and
          understand aggregate usage.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Data Sharing</h2>
        <p>
          We do not sell personal data. We may share limited data with service
          providers that help us host and monitor Drawspell.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Data Retention</h2>
        <p>
          We keep data only as long as reasonably necessary for operations,
          security, and legal obligations.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Contact</h2>
        <p>
          Questions about privacy can be sent to{" "}
          <a
            className="underline decoration-zinc-500 underline-offset-4 transition hover:decoration-zinc-200"
            href="mailto:feedback@drawspell.space"
          >
            feedback@drawspell.space
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy | Drawspell" },
      {
        name: "description",
        content: "Privacy Policy for Drawspell.",
      },
    ],
  }),
});
