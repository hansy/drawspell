import { richText, messageSlot } from "@/i18n/richText";
import { m } from "@/paraglide/messages.js";
import { agentDiscoveryLinks } from "@/content/publicPages";
import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

function PrivacyPolicyPage() {
  return (
    <LegalLayout title={m.public_pages_privacy_policy()} updatedAt="2026-03-01">
      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">
          {m.privacy_information_we_collect()}</h2>
        <p>
          {m.privacy_we_collect_minimal_technical_data_needed_to_run_drawspell_such_as()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">
          {m.privacy_how_we_use_information()}</h2>
        <p>
          {m.privacy_we_use_data_to_operate_the_service_improve_reliability_and_unders()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.privacy_data_sharing()}</h2>
        <p>
          {m.privacy_we_do_not_sell_personal_data_we_may_share_limited_data_with_servi()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.privacy_data_retention()}</h2>
        <p>
          {m.privacy_we_keep_data_only_as_long_as_reasonably_necessary_for_operations()}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-50">{m.privacy_contact()}</h2>
        <p>{richText(m.rich_privacy_questions_about_privacy_can_be_sent_to({ a_0: messageSlot("a_0") }), { a_0: (<a
            className="underline decoration-zinc-500 underline-offset-4 transition hover:decoration-zinc-200"
            href="mailto:feedback@drawspell.space"
          >
            feedback@drawspell.space
          </a>) })}</p>
      </section>
    </LegalLayout>
  );
}

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
  head: () => ({
    links: agentDiscoveryLinks("/privacy"),
    meta: [
      { title: m.privacy_privacy_policy_drawspell() },
      {
        name: "description",
        content: m.privacy_privacy_policy_for_drawspell(),
      },
    ],
  }),
});
