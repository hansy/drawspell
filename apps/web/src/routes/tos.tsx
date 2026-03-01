import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" updatedAt="March 1, 2026">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Use of Drawspell</h2>
        <p>
          These Terms govern use of the hosted Drawspell service at
          drawspell.space.
        </p>
        <p>
          The Drawspell source code repository is licensed separately under the
          LICENSE file in the repository and is not governed by these Terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Commercial Use</h2>
        <p>
          We may monetize the hosted service, including through paid plans,
          sponsorships, or other commercial models.
        </p>
        <p>
          You may not resell, sublicense, or commercially exploit the hosted
          service without prior written permission from Drawspell.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Acceptable Behavior</h2>
        <p>
          Do not use Drawspell to abuse, harass, disrupt games, or interfere
          with other users.
        </p>
        <p>
          We may suspend or block access if behavior harms the service or other
          people.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Service Availability</h2>
        <p>
          Drawspell is offered on an "as is" and "as available" basis. We may
          change, pause, or discontinue features at any time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Liability</h2>
        <p>
          To the maximum extent allowed by law, Drawspell is not liable for
          indirect, incidental, or consequential damages from use of the
          service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
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

export const Route = createFileRoute("/tos")({
  component: TermsOfServicePage,
  head: () => ({
    meta: [
      { title: "Terms of Service | Drawspell" },
      {
        name: "description",
        content: "Terms of Service for Drawspell.",
      },
    ],
  }),
});
