import { richText, messageSlot } from "@/i18n/richText";
import { m } from "@/paraglide/messages.js";
import type { ReactNode } from "react";
import { CodeExample } from "./CodeExample";

function Field({ name, type, children, fields }: { name: string; type: string; children: ReactNode; fields?: ReactNode }) {
  return <div className="api-field"><dt><code>{name}</code><span>{fieldType(type)}</span></dt><dd>{children}{fields && <dl className="api-subfields" aria-label={m.create_room_docs_properties({ name: name })}>{fields}</dl>}</dd></div>;
}
const errors = () => [
  ["400", "invalid_request", m.api_error_check_json_fields_and_required_headers()],
  ["401", "unauthorized", m.api_error_use_an_active_api_key()],
  ["403", "forbidden", m.api_error_account_disabled_or_rooms_create_permission_missing()],
  ["409", "idempotency_conflict", m.api_error_use_a_new_key_for_different_content()],
  ["410", "room_gone", m.api_error_room_expired_or_was_deleted_create_a_new_one()],
  ["413", "body_too_large", m.api_error_reduce_the_request_to_160_kib_or_less()],
  ["415", "unsupported_media_type", m.api_error_send_content_type_application_json()],
  ["429", "rate_limited", m.api_error_wait_for_retry_after_seconds()],
  ["503", "service_unavailable", m.api_error_retry_with_the_same_idempotency_key()],
];

export function CreateRoomDocs() {
  return (
    <article id="create-room" tabIndex={-1} aria-labelledby="request-title">
        <section className="api-section api-pair" aria-labelledby="request-title">
          <div className="api-reference">
            <h2 id="request-title">{m.create_room_docs_create_a_room()}</h2>
            <p className="api-endpoint-description">{m.create_room_docs_create_a_room_with_optional_preloaded_decks_and_personal_invitati()}</p>
            <div className="api-endpoint"><span>{m.create_room_docs_post()}</span><code>/api/v1/rooms</code></div>
            <h3>{m.create_room_docs_headers()}</h3>
            <dl>
              <Field name="Authorization" type="required">{richText(m.rich_createroomdocs_bearer_api_key_see({ a_0: messageSlot("a_0") }), { a_0: (<a href="#authentication">{m.create_room_docs_authentication()}</a>) })}</Field>
              <Field name="Content-Type" type="required"><code>{m.create_room_docs_application_json()}</code></Field>
              <Field name="Idempotency-Key" type="required">{m.create_room_docs_unique_per_creation_1_128_visible_ascii_characters()}</Field>
            </dl>
            <h3>{m.create_room_docs_body()}</h3>
            <p>{richText(m.rich_createroomdocs_send_for_a_default_room_maximum_160_kib_no_unknown_fiel({ code_0: messageSlot("code_0") }), { code_0: (<code>{"{}"}</code>) })}</p>
            <dl>
              <Field name="displaySpectatorLink" type="boolean · optional">{m.create_room_docs_defaults_to_true_set_false_to_hide_the_spectator_link_from_player()}</Field>
              <Field name="players" type="object[] · optional" fields={<>
                <Field name="externalId" type="string · required">{m.create_room_docs_your_player_identifier_1_128_characters_unique_within_this_reques()}</Field>
                <Field name="deck" type="object · optional" fields={<>
                  <Field name="decklist" type="string · required">{m.create_room_docs_deck_text_to_preload_up_to_32_kib()}</Field>
                  <Field name="bracket" type="integer · optional">{m.create_room_docs_1_5_stored_without_display()}</Field>
                </>}>{m.create_room_docs_deck_assigned_to_this_player_s_personal_link()}</Field>
              </>}>{m.create_room_docs_up_to_four_personal_invitations_each_item_contains()}</Field>
            </dl>
          </div>
          <CodeExample kind="Request" />
        </section>
        <section className="api-section api-pair" aria-labelledby="response-title">
          <div className="api-reference">
            <h3 id="response-title" className="api-subheading">{m.create_room_docs_response()}</h3>
            <dl>
              <Field name="playerInviteUrl" type="shared">{m.create_room_docs_anyone_with_the_link_can_join_an_available_seat()}</Field>
              <Field name="players[].joinUrl" type="personal">{richText(m.rich_createroomdocs_send_to_the_matching_loads_their_assigned_deck_no_seat({ code_0: messageSlot("code_0") }), { code_0: (<code>{m.create_room_docs_externalid()}</code>) })}</Field>
              <Field name="spectatorLink" type="string">{m.create_room_docs_always_returned_to_the_api_caller_anyone_with_this_link_can_watch()}</Field>
              <Field name="activationExpiresAt" type="ISO date">{m.create_room_docs_first_player_must_join_within_24_hours_active_games_continue_past()}</Field>
            </dl>
          </div>
          <CodeExample kind="Response" />
        </section>
        <section className="api-section api-pair api-operating" aria-label={m.create_room_docs_retries_and_limits()}>
          <div><h3 className="api-subheading">{m.create_room_docs_safe_retries()}</h3><p>{richText(m.rich_createroomdocs_reuse_the_same_key_and_content_for_up_to_24_hours_repla({ code_0: messageSlot("code_0"), code_1: messageSlot("code_1"), code_2: messageSlot("code_2"), code_3: messageSlot("code_3") }), { code_0: (<code>200</code>), code_1: (<code>{m.create_room_docs_idempotency_replayed_true()}</code>), code_2: (<code>409</code>), code_3: (<code>410</code>) })}</p></div>
          <div><h3 className="api-subheading">{m.create_room_docs_10_requests_minute()}</h3><p>{richText(m.rich_createroomdocs_shared_across_your_account_s_keys_including_retries_and({ code_0: messageSlot("code_0"), code_1: messageSlot("code_1") }), { code_0: (<code>429</code>), code_1: (<code>{m.create_room_docs_retry_after()}</code>) })}</p></div>
        </section>
        <details className="api-errors">
          <summary>{m.create_room_docs_error_reference()}<span>{m.create_room_docs_statuses_codes_and_a_json_example()}</span></summary>
          <div className="api-pair">
            <div className="api-error-table"><table><caption className="sr-only">{m.create_room_docs_api_error_codes()}</caption><thead><tr><th>{m.create_room_docs_status()}</th><th>{m.create_room_docs_code_action()}</th></tr></thead><tbody>{errors().map(([status, code, action]) => <tr key={code}><td>{status}</td><td><code>{code}</code><p>{action}</p></td></tr>)}</tbody></table></div>
            <CodeExample kind="Error" />
          </div>
        </details>
    </article>
  );
}

function fieldType(value: string) {
  return value.replace("required", m.field_required()).replace("optional", m.field_optional())
    .replace("shared", m.field_shared()).replace("personal", m.field_personal()).replace("ISO date", m.field_iso_date());
}
