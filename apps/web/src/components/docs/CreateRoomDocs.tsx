import type { ReactNode } from "react";
import { CodeExample } from "./CodeExample";

function Field({ name, type, children, fields }: { name: string; type: string; children: ReactNode; fields?: ReactNode }) {
  return <div className="api-field"><dt><code>{name}</code><span>{type}</span></dt><dd>{children}{fields && <dl className="api-subfields" aria-label={`${name} properties`}>{fields}</dl>}</dd></div>;
}
const errors = [
  ["400", "invalid_request", "Check JSON, fields, and required headers."],
  ["401", "unauthorized", "Use an active API key."],
  ["403", "forbidden", "Account disabled or rooms:create permission missing."],
  ["409", "idempotency_conflict", "Use a new key for different content."],
  ["410", "room_gone", "Room expired or was deleted. Create a new one."],
  ["413", "body_too_large", "Reduce the request to 160 KiB or less."],
  ["415", "unsupported_media_type", "Send Content-Type: application/json."],
  ["429", "rate_limited", "Wait for Retry-After seconds."],
  ["503", "service_unavailable", "Retry with the same Idempotency-Key."],
];

export function CreateRoomDocs() {
  return (
    <article id="create-room" aria-labelledby="request-title">
        <section className="api-section api-pair" aria-labelledby="request-title">
          <div className="api-reference">
            <h2 id="request-title">Create a room</h2>
            <p className="api-endpoint-description">Create a room with optional preloaded decks and personal invitations.</p>
            <div className="api-endpoint"><span>POST</span><code>/api/v1/rooms</code></div>
            <h3>Headers</h3>
            <dl>
              <Field name="Authorization" type="required">Bearer API key. See <a href="#authentication">authentication</a>.</Field>
              <Field name="Content-Type" type="required"><code>application/json</code></Field>
              <Field name="Idempotency-Key" type="required">Unique per creation; 1–128 visible ASCII characters.</Field>
            </dl>
            <h3>Body</h3>
            <p>Send <code>{"{}"}</code> for a default room. Maximum 160 KiB; no unknown fields.</p>
            <dl>
              <Field name="spectatorsEnabled" type="boolean · optional">Defaults to true. Set false to block spectators for the room’s lifetime.</Field>
              <Field name="players" type="object[] · optional" fields={<>
                <Field name="externalId" type="string · required">Your player identifier. 1–128 characters; unique within this request.</Field>
                <Field name="deck" type="object · optional" fields={<>
                  <Field name="decklist" type="string · required">Deck text to preload. Up to 32 KiB.</Field>
                  <Field name="bracket" type="integer · optional">1–5. Stored without display.</Field>
                </>}>Deck assigned to this player’s personal link.</Field>
              </>}>Up to four personal invitations. Each item contains:</Field>
            </dl>
          </div>
          <CodeExample kind="Request" />
        </section>
        <section className="api-section api-pair" aria-labelledby="response-title">
          <div className="api-reference">
            <h3 id="response-title" className="api-subheading">Response</h3>
            <dl>
              <Field name="playerInviteUrl" type="shared">Anyone with the link can join an available seat.</Field>
              <Field name="players[].joinUrl" type="personal">Send to the matching <code>externalId</code>. Loads their assigned deck; no seat reservation or identity check.</Field>
              <Field name="spectatorInviteUrl" type="conditional">Only returned when spectators are enabled.</Field>
              <Field name="activationExpiresAt" type="ISO date">First player must join within ten minutes. Active games continue past this deadline.</Field>
            </dl>
            <p className="api-note">Card lookup happens on join. Players can correct or swap decks; each successful load appears in the game log. Personal links protect the original assignment, not subsequent deck changes.</p>
          </div>
          <CodeExample kind="Response" />
        </section>
        <section className="api-section api-pair api-operating" aria-label="Retries and limits">
          <div><h3 className="api-subheading">Safe retries</h3><p>Reuse the same key and content for up to 24 hours. Replays return <code>200</code> with <code>Idempotency-Replayed: true</code>. Different content returns <code>409</code>; a room that is gone returns <code>410</code>.</p></div>
          <div><h3 className="api-subheading">10 requests / minute</h3><p>Shared across your account’s keys, including retries and rejected requests. On <code>429</code>, wait for <code>Retry-After</code> seconds.</p></div>
        </section>
        <details className="api-errors">
          <summary>Error reference <span>Statuses, codes, and a JSON example</span></summary>
          <div className="api-pair">
            <div className="api-error-table"><table><caption className="sr-only">API error codes</caption><thead><tr><th>Status</th><th>Code / action</th></tr></thead><tbody>{errors.map(([status, code, action]) => <tr key={code}><td>{status}</td><td><code>{code}</code><p>{action}</p></td></tr>)}</tbody></table></div>
            <CodeExample kind="Error" />
          </div>
        </details>
    </article>
  );
}
