import type { ReactNode } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  GitBranch,
  Gauge,
  Layers,
  RadioTower,
  Route,
  Server,
  ShieldAlert,
  Siren,
  TerminalSquare
} from "lucide-react";
import { Link } from "react-router-dom";
import { CodeBlock } from "../../shared/ui/CodeBlock";

const features = [
  ["Project monitoring", "Track monoliths, microservices, workers, queues, caches, and databases from one workspace."],
  ["Logs explorer", "Search logs by service, level, route, trace ID, request ID, status code, and time range."],
  ["Metrics dashboard", "Watch request count, latency, error rate, route performance, and custom signals together."],
  ["Alert rules", "Start with practical thresholds for latency, error rates, service health, and log errors."],
  ["Incidents", "Move from open to investigating, identified, monitoring, resolved, and closed with evidence."],
  ["AI root cause analysis", "Use logs, metrics, incidents, and deployments as evidence for faster incident understanding."],
  ["Deployment impact", "Connect release events to regressions in latency, errors, and health."],
  ["Multi-language SDKs", "Use Node.js, Python FastAPI, Go HTTP, Java Spring Boot, or generic HTTP ingestion."]
];

const useCases = [
  "Monitor a Node.js monolith",
  "Monitor FastAPI services",
  "Monitor Spring Boot APIs",
  "Monitor Go services",
  "Monitor microservices",
  "Track deployment regressions",
  "Debug slow endpoints",
  "Understand incidents faster"
];

const snippets = [
  [
    "Node.js Express",
    `app.use(aegisopsMiddleware({
  apiUrl: process.env.AEGISOPS_API_URL,
  apiKey: process.env.AEGISOPS_API_KEY,
  projectKey: "payments-api",
  serviceName: "api-gateway"
}));`
  ],
  [
    "Python FastAPI",
    `app = FastAPI()
add_aegisops_middleware(app)`
  ],
  [
    "Go HTTP",
    `client := aegisops.NewClientFromEnv()
http.ListenAndServe(":8080", client.Middleware(mux))`
  ],
  [
    "Generic HTTP",
    `curl -X POST http://localhost:8080/ingest/logs \\
  -H "Authorization: Bearer $AEGISOPS_API_KEY" \\
  -d '{"level":"info","message":"checkout complete"}'`
  ]
];

function PublicButton({ href, children, secondary = false }: { href: string; children: string; secondary?: boolean }) {
  return (
    <Link
      to={href}
      className={
        secondary
          ? "inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 text-sm font-semibold text-white/75 backdrop-blur-[2px] transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          : "inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-300 px-6 text-sm font-bold text-black shadow-[0_0_44px_rgba(255,255,255,0.2)] transition hover:from-white hover:to-gray-200"
      }
    >
      {children}
    </Link>
  );
}

function CommandSurface({ compact = false }: { compact?: boolean }) {
  const routes = [
    ["api-gateway", "2.4k/min", "99.97%"],
    ["payments", "184ms p95", "0.8% err"],
    ["worker-jobs", "14k queued", "healthy"]
  ];
  return (
    <div className="aegis-glass relative overflow-hidden rounded-[2rem] p-4 shadow-[0_36px_100px_rgba(0,0,0,0.5)]">
      <div className="absolute inset-x-0 top-0 h-px bg-white/40" />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/45 p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Operations command center</p>
              <p className="mt-1 text-xs text-white/45">Live service health, release impact, and incident evidence.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">Real signals</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Throughput", "2.4k/min"],
              ["P95 latency", "184ms"],
              ["Error rate", "0.8%"],
              ["Open incidents", "1"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs text-white/40">{label}</p>
                <p className="mt-2 text-xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          <div
            className={
              compact ? "mt-4 hidden" : "mt-4 flex h-52 items-end gap-2 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 sm:flex"
            }
          >
            {[28, 44, 36, 62, 52, 76, 48, 34, 88, 66, 40, 58, 73, 46].map((height, index) => (
              <span key={index} className="flex-1 rounded-t bg-white/75" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-3 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-white" />
              <p className="text-sm font-semibold text-white">AI RCA preview</p>
            </div>
            <p className="text-sm leading-6 text-text-soft">
              Payment latency increased after deployment v42. Evidence points to the payments route and a queue retry spike.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/45 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Service routes</p>
            <div className="grid gap-2">
              {routes.map(([name, signal, status]) => (
                <div
                  key={name}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <span className="truncate text-sm text-white">{name}</span>
                  <span className="text-xs text-white/50">{signal}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Logs", "Metrics", "Incidents"].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-center text-xs font-semibold text-white/70"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <main>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-4 pb-14 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 backdrop-blur-[2px]">
            Connect your project in minutes
          </p>
          <h1 className="text-6xl font-bold leading-[0.9] tracking-normal text-white sm:text-8xl">AegisOps</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-text-soft sm:text-xl">
            AI-powered monitoring for real backend systems. Connect services, watch logs and metrics, detect incidents, and understand root
            cause from one command center.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PublicButton href="/register">Start monitoring</PublicButton>
            <PublicButton href="/product" secondary>
              Explore product
            </PublicButton>
          </div>
        </div>

        <div className="mt-10">
          <CommandSurface />
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl gap-px px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            ["One setup path", "Create project, service, API key, and verification without leaving the flow."],
            ["Evidence first", "Incidents stay tied to logs, metrics, routes, deployments, and RCA."],
            ["Backend native", "Monoliths, workers, queues, APIs, and microservices use the same operating model."],
            ["Self-hostable", "Run the stack locally while keeping telemetry ownership close to your team."]
          ].map(([title, body]) => (
            <div key={title} className="min-h-40 border border-white/10 bg-black/35 p-5">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="mt-3 text-sm leading-6 text-text-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketingSection
        eyebrow="Workflow"
        title="From first signal to final action"
        intro="AegisOps is shaped around the operational journey, not a pile of disconnected dashboards."
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="aegis-glass rounded-[2rem] p-5">
            <p className="text-sm font-semibold text-white">Incident path</p>
            <div className="mt-5 grid gap-3">
              {[
                ["01", "Connect telemetry", "Install SDK or send HTTP events."],
                ["02", "Detect health drift", "Track error rate, latency, throughput, and route performance."],
                ["03", "Investigate with evidence", "Use logs, incidents, deployments, and metrics together."],
                ["04", "Act with confidence", "Create alerts, assign incidents, and generate RCA drafts."]
              ].map(([index, title, body]) => (
                <div key={title} className="grid grid-cols-[48px_1fr] gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                  <span className="text-sm font-bold text-white/35">{index}</span>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-text-soft">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Scattered logs", "Search by service, route, trace ID, request ID, level, status code, and time."],
              ["Unclear root cause", "AI RCA uses telemetry and incident context as evidence, not vague summaries."],
              ["Noisy alerts", "Start from practical latency, error, health, and log-error rules."],
              ["Release regressions", "Deployment records connect changes to incident and metric shifts."]
            ].map(([problem, body]) => (
              <div key={problem} className="aegis-glass rounded-[2rem] p-5">
                <ShieldAlert className="mb-4 h-5 w-5 text-amber" />
                <p className="font-semibold text-white">{problem}</p>
                <p className="mt-3 text-sm leading-6 text-text-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Platform"
        title="Core modules that work as one system"
        intro="Every module is connected to the same workspace, project, service, and organization context."
      >
        <FeatureGrid items={features} />
      </MarketingSection>

      <MarketingSection
        eyebrow="Developer experience"
        title="Instrument the stack you already run"
        intro="Use framework SDKs where they fit, or send clean HTTP telemetry from any runtime."
      >
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="aegis-glass rounded-[2rem] p-5">
            <TerminalSquare className="mb-5 h-5 w-5 text-white" />
            <p className="text-2xl font-bold text-white">SDK-first, API-compatible.</p>
            <p className="mt-4 text-sm leading-6 text-text-soft">
              Start with Node.js, Python FastAPI, Go HTTP, Java Spring Boot, or generic HTTP ingestion. The dashboard links keys, service
              names, project keys, and verification into one setup path.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {snippets.map(([title, code]) => (
              <div key={title} className="aegis-glass rounded-[1.75rem] p-4">
                <p className="mb-3 text-sm font-semibold text-white">{title}</p>
                <CodeBlock>{code}</CodeBlock>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <FinalCta />
    </main>
  );
}

function MarketingHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 pt-14 sm:px-6 lg:px-8">
      <div className="grid min-h-[42vh] content-end border-b border-white/10 pb-10">
        <p className="mb-4 text-sm font-semibold uppercase text-white/45">{eyebrow}</p>
        <h1 className="max-w-5xl text-5xl font-bold leading-[0.95] tracking-normal text-white sm:text-7xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-text-soft">{intro}</p>
      </div>
    </section>
  );
}

function MarketingSection({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-8 grid gap-4 lg:grid-cols-[0.6fr_1fr] lg:items-end">
        <div>
          {eyebrow ? <p className="mb-3 text-xs font-bold uppercase text-white/40">{eyebrow}</p> : null}
          <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h2>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-text-soft lg:justify-self-end">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function FeatureGrid({ items }: { items: string[][] }) {
  const icons = [Server, TerminalSquare, Gauge, ShieldAlert, Siren, BrainCircuit, GitBranch, Layers];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(([title, description], index) => {
        const Icon = icons[index % icons.length];
        return (
          <div key={title} className="group aegis-glass min-h-56 rounded-[2rem] p-5 transition hover:-translate-y-1 hover:bg-white/[0.08]">
            <div className="mb-8 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-3 text-sm leading-6 text-text-soft">{description}</p>
          </div>
        );
      })}
    </div>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="aegis-glass overflow-hidden rounded-[2rem] p-6 text-center sm:p-10">
        <p className="text-sm font-semibold uppercase text-white/45">Ready path</p>
        <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-bold leading-tight text-white">
          Connect a real service and see the first signal land.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-text-soft">
          Create a workspace, generate an API key, send a test event, and open your first operational dashboard.
        </p>
        <div className="mt-7 flex justify-center">
          <PublicButton href="/register">Start monitoring</PublicButton>
        </div>
      </div>
    </section>
  );
}

export function ProductPage() {
  const modules = [
    ["Overview", "Workspace health, throughput, latency, errors, incidents, deployments, and setup progress.", Gauge],
    ["Connect Project", "Project creation, services, API keys, SDK instructions, and connection verification.", Route],
    ["Logs", "Search application logs by service, level, route, trace ID, request ID, status code, and time.", TerminalSquare],
    ["Metrics", "Explore raw metrics, aggregate windows, p50, p95, p99, and route signals.", RadioTower],
    ["Incidents", "Track lifecycle, evidence, RCA, and postmortem drafts.", Siren],
    ["AI RCA", "Summarize likely causes using telemetry and incident context.", BrainCircuit],
    ["Deployments", "Track release events and impact reports.", GitBranch],
    ["Notifications", "Route alerts to team destinations and escalation policies.", ShieldAlert],
    ["SDKs", "Support Node.js Express, Python FastAPI, Go HTTP, Java Spring Boot, and generic HTTP.", TerminalSquare]
  ] as const;

  return (
    <main>
      <MarketingHero
        eyebrow="Product"
        title="One operations workspace for setup, monitoring, incidents, and RCA."
        intro="AegisOps keeps project context, service telemetry, incident evidence, alerting, and AI analysis inside one professional command surface."
      />
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(([title, body, Icon], index) => (
            <div key={title} className="aegis-glass rounded-[2rem] p-5">
              <div className="mb-6 flex items-center justify-between">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-xs font-bold text-white/25">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-3 text-sm leading-6 text-text-soft">{body}</p>
              <Link to="/register" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
                Explore module <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export function SolutionsPage() {
  return (
    <main>
      <MarketingHero
        eyebrow="Solutions"
        title="Built for backend teams, platform owners, and release-driven organizations."
        intro="Use one telemetry model for monoliths, microservices, workers, APIs, and service ownership without forcing every team into separate tools."
      />
      <MarketingSection
        eyebrow="Team fit"
        title="Operational shapes AegisOps supports"
        intro="The same workspace model adapts to different teams and service architectures."
      >
        <FeatureGrid
          items={[
            ["For backend teams", "Monitor routes, request latency, logs, errors, and service health."],
            ["For DevOps/SRE teams", "Use alert rules, incidents, dashboards, deployments, and audit logs."],
            ["For startups", "Start locally, connect quickly, and avoid a heavy observability rollout."],
            ["For monolith apps", "Track one deployable service without pretending it is a distributed system."],
            ["For microservices", "Group many services under one project with per-service signals."],
            ["For self-hosted teams", "Run the stack locally and keep operational data close."],
            ["For AI/product teams", "Explain incidents faster with evidence-backed RCA."],
            ["For release owners", "Track deployment regressions and post-release health."]
          ]}
        />
      </MarketingSection>
    </main>
  );
}

export function PricingPage() {
  const plans = [
    ["Developer", "Local and early team usage", "Connect projects, use SDKs, logs, metrics, incidents, and real service telemetry."],
    ["Team", "Shared operations workspace", "Team workspace, alert rules, notifications, reports, and audit trail."],
    ["Self-hosted", "Own your telemetry plane", "Run AegisOps in your own environment with production-ready configuration."],
    ["Enterprise", "Organization support", "Security review, deployment assistance, and operational rollout guidance."]
  ];
  return (
    <main>
      <MarketingHero
        eyebrow="Pricing"
        title="Simple packaging for teams that want operational clarity."
        intro="AegisOps is designed for practical adoption: start with one project, expand to team-wide monitoring, then self-host or scale with support."
      />
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map(([name, price, body]) => (
            <div key={name} className="aegis-glass flex min-h-80 flex-col rounded-[2rem] p-5">
              <p className="text-lg font-bold text-white">{name}</p>
              <p className="mt-3 text-sm font-semibold text-white/70">{price}</p>
              <p className="mt-5 flex-1 text-sm leading-6 text-text-soft">{body}</p>
              <PublicButton href={name === "Enterprise" ? "/docs" : "/register"}>
                {name === "Enterprise" ? "Talk to us" : "Start monitoring"}
              </PublicButton>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export function UseCasesPage() {
  return (
    <main>
      <MarketingHero
        eyebrow="Use cases"
        title="Real backend operations, from one service to many."
        intro="AegisOps keeps telemetry useful whether you are debugging a slow endpoint, watching a release, or explaining a production incident."
      />
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <CommandSurface compact />
        <div className="grid gap-3 sm:grid-cols-2">
          {useCases.map((item) => (
            <div key={item} className="aegis-glass rounded-[1.5rem] p-4">
              <CheckCircle2 className="mb-4 h-5 w-5 text-white" />
              <p className="font-semibold text-white">{item}</p>
              <p className="mt-2 text-sm leading-6 text-text-soft">
                Use logs, metrics, incidents, deployments, and AI RCA to move from signal to action.
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
