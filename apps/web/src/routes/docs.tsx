import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CreateRoomDocs } from "@/components/docs/CreateRoomDocs";
import "@/components/docs/docs.css";

export const Route = createFileRoute("/docs")({ component: ApiDocs });

// Each endpoint owns its request, response, examples, and operational details.
const resources = [
  { name: "Rooms", endpoints: [
    { id: "create-room", title: "Create a room", method: "POST", Component: CreateRoomDocs },
  ] },
];

function ApiDocs() {
  return (
    <div className="api-docs">
      <header className="api-nav"><a href="/" className="api-brand">Drawspell</a><span>API reference</span><a href="/developer">API keys <ArrowRight size={14} /></a></header>
      <div className="api-layout">
        <nav className="api-sidebar" aria-label="API documentation">
          <div><h2>Getting started</h2><a href="#overview">Overview</a><a href="#authentication">Authentication</a></div>
          {resources.map(resource => <div key={resource.name}>
            <h2>{resource.name}</h2>
            {resource.endpoints.map(endpoint => <a key={endpoint.id} href={`#${endpoint.id}`}><span className="api-nav-method">{endpoint.method}</span>{endpoint.title}</a>)}
          </div>)}
        </nav>
        <main className="api-content">
          <div className="api-heading" id="overview">
            <div><h1>Drawspell API</h1><p>Connect your app to Drawspell.</p></div>
            <a href="/developer" className="api-button">Get API key <ArrowRight size={16} /></a>
          </div>
          <div className="api-base-url"><span>Base URL</span><code>https://drawspell.space/api/v1</code></div>
          <section id="authentication" className="api-section api-pair" aria-labelledby="authentication-title">
            <div>
              <h2 id="authentication-title">Authentication</h2>
              <p><a href="/developer">Sign in with an email link</a> and create an API key in your dashboard. Copy the key when it’s created; it’s shown only once.</p>
              <p>Send it in the <code>Authorization</code> header with every API request. Keep the key in a server environment variable, outside browser code and shared URLs.</p>
            </div>
            <div className="api-auth-details">
              <pre aria-label="Authorization header"><code><span>Authorization:</span> Bearer YOUR_API_KEY</code></pre>
              <p>Manage up to five active keys in <a href="/developer">your dashboard</a>. To rotate a key, create a replacement, update your app, then revoke the old key.</p>
              <p>Missing, invalid, or revoked keys return <code>401 unauthorized</code>. Disabled accounts or insufficient permissions return <code>403 forbidden</code>.</p>
            </div>
          </section>
          {resources.flatMap(resource => resource.endpoints.map(({ id, Component }) => <Component key={id} />))}
        </main>
      </div>
      <footer><a href="/">Drawspell</a><a href="mailto:support@drawspell.space">Need help?</a></footer>
    </div>
  );
}
