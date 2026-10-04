import { Link } from "react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  Code2Icon,
  SparklesIcon,
  UsersIcon,
  VideoIcon,
  ZapIcon,
} from "lucide-react";
import { SignInButton } from "@clerk/clerk-react";

// Static data lives outside the component so it is not recreated on every render.
const PILLS = ["Live Video Chat", "Code Editor", "Multi-Language"];

const STATS = [
  { value: "10K+", label: "Active Users", color: "text-primary" },
  { value: "50K+", label: "Sessions", color: "text-secondary" },
  { value: "99.9%", label: "Uptime", color: "text-accent" },
];

const FEATURES = [
  {
    icon: <VideoIcon className="size-8 text-primary" aria-hidden="true" />,
    title: "HD Video Call",
    text: "Crystal clear video and audio for seamless communication during interviews",
  },
  {
    icon: <Code2Icon className="size-8 text-primary" aria-hidden="true" />,
    title: "Live Code Editor",
    text: "Collaborate in real-time with syntax highlighting and multiple language support",
  },
  {
    icon: <UsersIcon className="size-8 text-primary" aria-hidden="true" />,
    title: "Easy Collaboration",
    text: "Share your screen, discuss solutions, and learn from each other in real-time",
  },
];

function Navbar() {
  return (
    <header className="bg-base-100 border-b border-primary/20 sticky top-0 z-50 shadow-lg">
      <nav
        className="max-w-7xl mx-auto p-4 flex items-center justify-between"
        aria-label="Main"
      >
        <Link to="/" className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg">
            <SparklesIcon className="size-6 text-white" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent font-mono tracking-wider">
              Talent-Talk
            </span>
            <span className="text-xs text-base-content/60 font-medium -mt-1">
              Code Together
            </span>
          </div>
        </Link>

        <SignInButton mode="modal">
          <button className="group px-6 py-3 bg-gradient-to-r from-primary to-secondary rounded-xl text-white font-semibold text-sm shadow-lg flex items-center gap-2">
            <span>Get Started</span>
            <ArrowRightIcon
              className="size-4 group-hover:translate-x-0.5 transition-transform"
              aria-hidden="true"
            />
          </button>
        </SignInButton>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="badge badge-primary badge-lg gap-1">
            <ZapIcon className="size-4" aria-hidden="true" />
            Real-time Collaboration
          </div>

          <h1 className="text-5xl lg:text-7xl font-black leading-tight">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Code Together,
            </span>
            <br />
            <span className="text-base-content">Learn Together</span>
          </h1>

          <p className="text-xl text-base-content/70 leading-relaxed max-w-xl">
            The ultimate platform for collaborative coding interviews and pair
            programming. Connect face-to-face, code in real-time, and ace your
            technical interviews.
          </p>

          <ul className="flex flex-wrap gap-3">
            {PILLS.map((pill) => (
              <li key={pill} className="badge badge-lg badge-outline gap-1">
                <CheckIcon className="size-4 text-success" aria-hidden="true" />
                {pill}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-4">
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">
                Start Coding Now
                <ArrowRightIcon className="size-5" aria-hidden="true" />
              </button>
            </SignInButton>

            {/* Was a button that did nothing. Now it scrolls to the features. */}
            <a href="#features" className="btn btn-outline btn-lg">
              <VideoIcon className="size-5" aria-hidden="true" />
              See Features
            </a>
          </div>

          <div className="stats stats-vertical lg:stats-horizontal bg-base-100 shadow-lg">
            {STATS.map((s) => (
              <div key={s.label} className="stat">
                <div className={`stat-value ${s.color}`}>{s.value}</div>
                <div className="stat-title">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <img
          src="/hero.avif"
          alt="Two developers pair programming over video in the Talent-Talk editor"
          width="1200"
          height="900"
          fetchPriority="high"
          decoding="async"
          className="w-full h-auto rounded-3xl shadow-2xl border-4 border-base-100"
        />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold mb-4">
          Everything You Need to{" "}
          <span className="text-primary font-mono">Succeed</span>
        </h2>
        <p className="text-lg text-base-content/70 max-w-2xl mx-auto">
          Powerful features designed to make your coding interviews seamless and
          productive
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {FEATURES.map(({ icon, title, text }) => (
          <article key={title} className="card bg-base-100 shadow-xl">
            <div className="card-body items-center text-center">
              <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                {icon}
              </div>
              <h3 className="card-title">{title}</h3>
              <p className="text-base-content/70">{text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-base-content/10 py-8 text-center text-sm text-base-content/60">
      © {new Date().getFullYear()} Talent-Talk. All rights reserved.
    </footer>
  );
}

function HomePage() {
  return (
    <div className="bg-gradient-to-br from-base-100 via-base-200 to-base-300">
      <Navbar />
      <main>
        <Hero />
        <Features />
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;