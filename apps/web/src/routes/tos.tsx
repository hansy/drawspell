import { richText, messageSlot } from "@/i18n/richText";
import { m } from "@/paraglide/messages.js";
import { agentDiscoveryLinks } from "@/content/publicPages";
import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

function TermsOfServicePage() {
  return (
    <LegalLayout title={m.public_pages_terms_of_service()} updatedAt="2026-03-01">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.tos_use_of_drawspell()}</h2>
        <p>
          {m.tos_these_terms_govern_use_of_the_hosted_drawspell_service_at_drawspe()}</p>
        <p>
          {m.tos_the_drawspell_source_code_repository_is_licensed_separately_under()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.tos_commercial_use()}</h2>
        <p>
          {m.tos_we_may_monetize_the_hosted_service_including_through_paid_plans_s()}</p>
        <p>
          {m.tos_you_may_not_resell_sublicense_or_commercially_exploit_the_hosted()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.tos_acceptable_behavior()}</h2>
        <p>
          {m.tos_do_not_use_drawspell_to_abuse_harass_disrupt_games_or_interfere_w()}</p>
        <p>
          {m.tos_we_may_suspend_or_block_access_if_behavior_harms_the_service_or_o()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.tos_service_availability()}</h2>
        <p>
          {m.tos_drawspell_is_offered_on_an_as_is_and_as_available_basis_we_may_ch()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.tos_liability()}</h2>
        <p>
          {m.tos_to_the_maximum_extent_allowed_by_law_drawspell_is_not_liable_for()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.privacy_contact()}</h2>
        <p>{richText(m.rich_tos_questions_about_these_terms_can_be_sent_to({ a_0: messageSlot("a_0") }), { a_0: (<a
            className="underline decoration-zinc-500 underline-offset-4 transition hover:decoration-zinc-200"
            href="mailto:feedback@drawspell.space"
          >
            feedback@drawspell.space
          </a>) })}</p>
      </section>
    </LegalLayout>
  );
}

export const Route = createFileRoute("/tos")({
  component: TermsOfServicePage,
  head: () => ({
    links: agentDiscoveryLinks("/tos"),
    meta: [
      { title: m.tos_terms_of_service_drawspell() },
      {
        name: "description",
        content: m.tos_terms_of_service_for_drawspell(),
      },
    ],
  }),
});
