import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import examples from "@/generated/doc-examples.json";

function CopyCode({ code, ready }: { code: string; ready: boolean }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <button disabled={!ready} className="api-copy" aria-label="Copy code" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setStatus("copied"); }
      catch { setStatus("error"); }
    }}>
      {status === "copied" ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">{status === "copied" ? "Copied" : status === "error" ? "Select to copy" : "Copy"}</span>
    </button>
  );
}

export function CodeExample({ kind }: { kind: "Request" | "Response" | "Error" }) {
  const [language, setLanguage] = useState("cURL");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const label = kind === "Request" ? language : kind;
  const example = examples.find(item => item.label === label)!;
  return (
    <div className="api-code" role="region" aria-label={`${kind} example`}>
      <div className="api-code-bar">
        {kind === "Request" ? (
          <div className="api-languages" role="group" aria-label="Request language">
            {["cURL", "JavaScript"].map(value => (
              <button key={value} disabled={!ready} aria-pressed={value === language} onClick={() => setLanguage(value)}>{value}</button>
            ))}
          </div>
        ) : <span><span className="api-status">{kind === "Response" ? "201" : "409"}</span> {kind === "Response" ? "Room created" : "Error response"}</span>}
        <CopyCode key={label} code={example.code} ready={ready} />
      </div>
      {/* Trusted HTML generated from repository-owned examples during the build. */}
      <div className="api-code-body" tabIndex={0} aria-label={`${label} code`} dangerouslySetInnerHTML={{ __html: example.html }} />
    </div>
  );
}
