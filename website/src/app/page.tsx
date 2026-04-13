import WaitlistButton from "./components/WaitlistButton";

/* ── Hanger logo icon (matches the generated logo) ── */
function HangerIcon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M32 8C32 8 26 8 26 14C26 18 30 19 32 19" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M32 19L32 24L14 36M32 24L50 36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="14" y1="36" x2="50" y2="36" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <line x1="21" y1="36" x2="21" y2="40" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="32" y1="36" x2="32" y2="39.5" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="43" y1="36" x2="43" y2="40" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="17" y="40" width="8" height="8" fill="var(--neo-accent)" stroke="currentColor" strokeWidth="2"/>
      <circle cx="32" cy="44" r="4.5" fill="var(--neo-yellow)" stroke="currentColor" strokeWidth="2"/>
      <polygon points="43,48 47,40 39,40" fill="var(--neo-blue)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Fake nav bar matching the real AppNav ── */
function MockNav({ active = "chat" }: { active?: "chat" | "wardrobe" | "upload" }) {
  const tabs = [
    { id: "chat", label: "Chat", dot: "rounded-full" },
    { id: "wardrobe", label: "Wardrobe", dot: "" },
    { id: "upload", label: "Upload", dot: "triangle" },
  ] as const;
  return (
    <div className="flex items-center justify-between border-b-2 border-neo-border bg-neo-surface px-3 py-2">
      <div className="flex items-center gap-1.5">
        <HangerIcon size={20} className="text-neo-ink" />
        <span className="text-[9px] font-black uppercase tracking-tight text-neo-ink">
          Style<span className="text-neo-accent">Me</span>
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-1 px-2 py-1 text-[7px] font-extrabold uppercase tracking-wider ${
              active === t.id
                ? "border-2 border-neo-border bg-neo-yellow text-neo-ink shadow-[1px_1px_0_0_var(--neo-shadow)]"
                : "text-neo-mute"
            }`}
          >
            <div className={`h-1.5 w-1.5 border border-current ${t.dot}`} />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Fake browser chrome ── */
function BrowserFrame({ children, url = "styleme.app", className = "" }: { children: React.ReactNode; url?: string; className?: string }) {
  return (
    <div className={`border-3 border-neo-border bg-neo-surface shadow-[8px_8px_0_0_var(--neo-shadow)] transition-all duration-300 hover:shadow-[10px_10px_0_0_var(--neo-shadow)] hover:-translate-x-px hover:-translate-y-px ${className}`}>
      <div className="flex items-center gap-2 border-b-2 border-neo-border px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-neo-accent" />
        <div className="h-2.5 w-2.5 rounded-full bg-neo-yellow" />
        <div className="h-2.5 w-2.5 rounded-full bg-neo-lime" />
        <div className="ml-2 flex h-4 flex-1 items-center border border-neo-border bg-neo-bg px-2">
          <span className="text-[7px] font-bold text-neo-mute">{url}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── SVG icons ── */
function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
      <path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShoppingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function TryOnIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}


const FEATURES = [
  {
    icon: <UploadIcon />,
    title: "Upload & Auto-Detect",
    desc: "Drop a photo and every garment is detected automatically — shirts, pants, shoes, accessories — all separated and added to your digital closet.",
    color: "bg-neo-blue",
  },
  {
    icon: <ScissorsIcon />,
    title: "Individual Garments",
    desc: "Each piece of clothing is cleanly cut out from the photo and stored as its own item. No manual tagging, no tedious data entry.",
    color: "bg-neo-accent",
  },
  {
    icon: <SparklesIcon />,
    title: "Rich Details",
    desc: "Every garment is analyzed for type, color, pattern, material, season, formality, and style — so your closet is fully searchable.",
    color: "bg-neo-yellow",
  },
  {
    icon: <ChatIcon />,
    title: "Personal Stylist Chat",
    desc: "Chat with a stylist that actually knows your wardrobe. Ask for outfit ideas and get complete looks pulled from your own clothes, streamed in real-time.",
    color: "bg-neo-lime",
  },
  {
    icon: <ShoppingIcon />,
    title: "Shop the Web",
    desc: "Ask for shopping recommendations and get real product links, prices, and reviews from across the web — not generic advice.",
    color: "bg-neo-accent-2 border-t-neo-accent-2",
  },
  {
    icon: <TryOnIcon />,
    title: "Virtual Try-On",
    desc: "See how a complete outfit looks on you before you step out the door. Pick an outfit and preview it with your selfie.",
    color: "bg-neo-accent",
  },
] as const;

const STEPS = [
  { num: "01", title: "Sign up & snap a selfie", desc: "Your selfie lets you preview outfits on yourself before heading out.", accent: "rounded-full bg-neo-accent" },
  { num: "02", title: "Upload your wardrobe", desc: "Drop outfit photos. Every garment gets detected, separated, and cataloged automatically.", accent: "bg-neo-yellow" },
  { num: "03", title: "Chat with your stylist", desc: "Ask for outfits from your closet, shopping ideas from the web, or trend advice — all in one conversation.", accent: "bg-neo-lime" },
  { num: "04", title: "Try it on", desc: "See the full outfit on you before you commit. No more guessing in front of the mirror.", accent: "rounded-full bg-neo-blue" },
] as const;

const MARQUEE_ITEMS = [
  "Casual Friday", "Date Night", "Job Interview", "Beach Day", "Winter Layers",
  "Festival Fit", "Brunch Vibes", "Gym to Street", "Black Tie", "Road Trip",
  "Cozy Sunday", "First Date", "Office Power", "Summer Wedding",
];

const MARQUEE_DOTS = ["rounded-full bg-neo-accent", "bg-neo-yellow", "rounded-full bg-neo-blue"];


export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b-3 border-neo-border" style={{ background: "color-mix(in srgb, var(--neo-surface) 95%, transparent)", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2 hover-jelly">
            <HangerIcon size={36} className="text-neo-ink" />
            <span className="text-lg font-black uppercase tracking-tight text-neo-ink">
              Style<span className="text-neo-accent">Me</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden text-xs font-extrabold uppercase tracking-wider text-neo-mute transition-colors hover:text-neo-ink sm:block">Features</a>
            <a href="#how" className="hidden text-xs font-extrabold uppercase tracking-wider text-neo-mute transition-colors hover:text-neo-ink sm:block">How it works</a>
            <WaitlistButton className="neo-btn bg-neo-accent px-5 py-2 text-xs text-white">Join Waitlist</WaitlistButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-10 pt-16 sm:px-8 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 texture-dots" style={{ opacity: 0.5 }} />

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[6%] top-[10%] h-16 w-16 border-3 border-neo-accent bg-neo-pink-soft animate-float" />
          <div className="absolute right-[8%] top-[16%] h-14 w-14 rounded-full border-3 border-neo-yellow bg-neo-yellow-soft animate-float-alt" />
          <div className="absolute bottom-[25%] left-[10%] h-10 w-10 rounded-full border-2 border-neo-blue bg-neo-cyan-soft animate-float" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-[20%] right-[12%] h-8 w-8 border-2 border-neo-lime bg-neo-lime-soft animate-float-alt" style={{ animationDelay: "0.5s" }} />
          <div className="absolute left-[20%] top-[60%] h-5 w-5 border-2 border-neo-yellow bg-neo-yellow-soft animate-float-spin" style={{ animationDelay: "2s" }} />
          <div className="absolute right-[20%] top-[70%] h-4 w-4 rounded-full border-2 border-neo-accent bg-neo-pink-soft animate-wiggle" />
          <div className="absolute left-1/2 top-[6%] h-52 w-52 -translate-x-1/2 rounded-full border-3 border-dashed border-neo-mute animate-spin-slow" style={{ opacity: 0.12 }} />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-10 text-center">
          <div className="animate-bounce-in hover-jelly">
            <HangerIcon size={100} className="text-neo-ink" />
          </div>

          <div className="max-w-3xl animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            <h1 className="text-4xl font-black uppercase leading-[1.05] tracking-tight text-neo-ink sm:text-6xl md:text-7xl">
              Your wardrobe,{" "}
              <span className="relative inline-block -rotate-2 border-3 border-neo-border bg-neo-yellow px-3 py-1 text-neo-ink shadow-[3px_3px_0_0_var(--neo-shadow)] hover-tilt sm:px-4">
                styled by AI
                <span className="absolute -right-2 -top-2 h-3 w-3 rounded-full bg-neo-accent animate-pulse-scale" />
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base font-medium leading-relaxed text-neo-mute sm:text-lg">
              Upload your clothes, and every piece is detected, separated, and cataloged instantly. Chat for outfit picks from your closet, shop the web for new finds, and try everything on before you head out.
            </p>
          </div>

          <div className="h-[3px] w-32 animate-draw-line bg-neo-accent" style={{ animationDelay: "0.5s" }} />

          <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <WaitlistButton className="neo-btn bg-neo-accent px-8 py-3.5 text-sm text-white sm:text-base">Join Waitlist</WaitlistButton>
            <a href="#features" className="neo-btn bg-neo-surface px-8 py-3.5 text-sm text-neo-ink sm:text-base">See Features</a>
          </div>
        </div>
      </section>

      {/* App mockup: Chat Stylist view */}
      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-3xl scroll-reveal">
          <BrowserFrame url="styleme.app/chat">
            <MockNav active="chat" />
            <div className="bg-neo-bg p-4" style={{ backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px), linear-gradient(180deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              {/* User message */}
              <div className="mb-3 flex justify-end">
                <div className="flex items-start gap-2">
                  <div className="border-2 border-neo-border bg-neo-yellow-soft px-3 py-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <p className="text-[10px] font-bold text-neo-ink">Style me for a summer brunch</p>
                  </div>
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neo-border bg-neo-yellow shadow-[1px_1px_0_0_var(--neo-shadow)]">
                    <span className="text-[8px] font-black text-neo-ink">U</span>
                  </div>
                </div>
              </div>
              {/* AI message */}
              <div className="mb-3 flex justify-start">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-neo-border bg-neo-accent shadow-[1px_1px_0_0_var(--neo-shadow)]">
                    <HangerIcon size={14} className="text-white" />
                  </div>
                  <div className="max-w-[280px] border-2 border-neo-border bg-neo-surface px-3 py-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <p className="text-[10px] font-medium text-neo-ink">Here&apos;s a breezy outfit from your wardrobe! I picked your <strong className="font-extrabold">linen shirt</strong>, <strong className="font-extrabold">chino shorts</strong>, and <strong className="font-extrabold">white sneakers</strong> for a relaxed brunch vibe.</p>
                    <div className="mt-1 flex items-center gap-1">
                      <div className="h-1 w-1 rounded-full bg-neo-accent animate-pulse-soft" />
                      <span className="text-[7px] font-extrabold uppercase tracking-widest text-neo-mute">Streamed live</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Garment match cards */}
              <div className="ml-8 grid grid-cols-3 gap-2">
                {[
                  { bg: "bg-neo-cyan-soft", label: "Linen Shirt", tag: "Upper" },
                  { bg: "bg-neo-yellow-soft", label: "Chino Shorts", tag: "Lower" },
                  { bg: "bg-neo-pink-soft", label: "White Sneakers", tag: "Shoes" },
                ].map((item, i) => (
                  <div key={i} className="border-2 border-neo-border bg-neo-surface shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <div className={`aspect-square w-full ${item.bg} texture-crosshatch`} />
                    <div className="border-t border-neo-border p-1.5">
                      <div className="text-[7px] font-extrabold uppercase text-neo-ink">{item.label}</div>
                      <div className="mt-0.5 text-[6px] font-bold uppercase text-neo-mute">{item.tag}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Composer bar */}
              <div className="mt-4 flex gap-2">
                <div className="flex h-8 flex-1 items-center border-2 border-neo-border bg-neo-surface px-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                  <span className="text-[8px] font-bold uppercase text-neo-mute" style={{ opacity: 0.4 }}>Ask your stylist anything...</span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center border-2 border-neo-border bg-neo-accent shadow-[2px_2px_0_0_var(--neo-shadow)]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* App mockup: Shopping view */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-3xl scroll-reveal">
          <BrowserFrame url="styleme.app/chat">
            <MockNav active="chat" />
            <div className="bg-neo-bg p-4" style={{ backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px), linear-gradient(180deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              {/* User message */}
              <div className="mb-3 flex justify-end">
                <div className="flex items-start gap-2">
                  <div className="border-2 border-neo-border bg-neo-yellow-soft px-3 py-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <p className="text-[10px] font-bold text-neo-ink">Find me a good jacket under $300</p>
                  </div>
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neo-border bg-neo-yellow shadow-[1px_1px_0_0_var(--neo-shadow)]">
                    <span className="text-[8px] font-black text-neo-ink">U</span>
                  </div>
                </div>
              </div>
              {/* AI message with web results */}
              <div className="mb-3 flex justify-start">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 border-neo-border bg-neo-accent shadow-[1px_1px_0_0_var(--neo-shadow)]">
                    <HangerIcon size={14} className="text-white" />
                  </div>
                  <div className="max-w-[280px] border-2 border-neo-border bg-neo-surface px-3 py-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <p className="text-[10px] font-medium text-neo-ink">Here are some great jackets under $300 from the web:</p>
                    {/* Mock web results */}
                    <div className="mt-2 space-y-1.5">
                      {[
                        { name: "Levi's Trucker Jacket", price: "$89", site: "nordstrom.com" },
                        { name: "Carhartt WIP Detroit Jacket", price: "$199", site: "ssense.com" },
                        { name: "Nike Sportswear Windrunner", price: "$110", site: "nike.com" },
                      ].map((p, i) => (
                        <div key={i} className="flex items-center gap-2 border border-neo-border bg-neo-bg p-1.5">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-neo-blue">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[8px] font-bold text-neo-ink">{p.name}</div>
                            <div className="flex items-center gap-1">
                              <span className="text-[7px] font-extrabold text-neo-accent">{p.price}</span>
                              <span className="text-[6px] text-neo-mute">{p.site}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--neo-blue)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      <span className="text-[7px] font-extrabold uppercase tracking-widest text-neo-blue">Live web results</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* Occasion Marquee */}
      <div className="overflow-hidden border-y-3 border-neo-border bg-neo-surface py-4 texture-lines">
        <div className="animate-marquee flex w-max gap-6 whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-3 text-sm font-extrabold uppercase tracking-wider text-neo-ink">
              <span className={`h-2.5 w-2.5 ${MARQUEE_DOTS[i % 3]}`} />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="relative px-5 py-20 sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute inset-0 texture-dots" style={{ opacity: 0.3 }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 max-w-xl scroll-reveal">
            <HangerIcon size={28} className="text-neo-mute animate-wiggle" />
            <h2 className="mt-5 text-3xl font-black uppercase tracking-tight text-neo-ink sm:text-4xl">Everything you need</h2>
            <div className="mt-3 h-[3px] w-16 bg-neo-accent animate-draw-line" />
            <p className="mt-4 text-sm font-medium leading-relaxed text-neo-mute sm:text-base">
              From uploading photos to getting dressed, StyleMe handles the entire flow — powered by AI at every step.
            </p>
          </div>

          <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className={`neo-card flex flex-col gap-4 p-6 border-t-4 ${f.color.includes("border-t-") ? f.color.split(" ")[1] : f.color.replace("bg-", "border-t-")}`}>
                <div className={`flex h-14 w-14 items-center justify-center border-3 border-neo-border ${f.color.split(" ")[0]} text-white shadow-[3px_3px_0_0_var(--neo-shadow)] hover-jelly`}>
                  {f.icon}
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-neo-ink">{f.title}</h3>
                <p className="text-sm leading-relaxed text-neo-mute">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wardrobe mockup */}
      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-3xl scroll-reveal">
          <BrowserFrame url="styleme.app/wardrobe">
            <MockNav active="wardrobe" />
            <div className="bg-neo-bg p-4" style={{ backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px), linear-gradient(180deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              {/* Wardrobe header card */}
              <div className="border-2 border-neo-border bg-neo-surface p-3 shadow-[3px_3px_0_0_var(--neo-shadow)]">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full border border-neo-border bg-neo-accent" />
                  <div className="h-2 w-2 border border-neo-border bg-neo-yellow" />
                  <div className="h-2 w-2 border border-neo-border bg-neo-blue" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
                </div>
                <div className="mt-2 text-[11px] font-black uppercase tracking-tight text-neo-ink">Your Wardrobe</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="flex h-3.5 items-center border border-neo-border bg-neo-yellow-soft px-1 text-[7px] font-extrabold text-neo-ink">12</span>
                  <span className="text-[8px] text-neo-mute">items in your collection</span>
                </div>
                {/* Category pills */}
                <div className="mt-2 flex flex-wrap gap-1 border-t border-neo-border pt-2">
                  {["Shirt", "Pants", "Jacket", "Shoes", "Dress", "Accessory"].map((c, i) => (
                    <span key={c} className={`px-1.5 py-0.5 text-[6px] font-extrabold uppercase ${i === 0 ? "border border-neo-border bg-neo-yellow text-neo-ink shadow-[1px_1px_0_0_var(--neo-shadow)]" : "text-neo-mute"}`}>{c}</span>
                  ))}
                </div>
              </div>
              {/* Garment grid with metadata */}
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {[
                  { top: "bg-neo-accent", bg: "bg-neo-pink-soft", label: "Linen Shirt", meta: "Cotton · Summer" },
                  { top: "bg-neo-blue", bg: "bg-neo-cyan-soft", label: "Slim Jeans", meta: "Denim · All-year" },
                  { top: "bg-neo-yellow", bg: "bg-neo-yellow-soft", label: "Bomber Jacket", meta: "Nylon · Fall" },
                  { top: "bg-neo-lime", bg: "bg-neo-lime-soft", label: "Sneakers", meta: "Leather · Casual" },
                  { top: "bg-neo-accent", bg: "bg-neo-peach", label: "Midi Dress", meta: "Silk · Formal" },
                  { top: "bg-neo-blue", bg: "bg-neo-cyan-soft", label: "Chino Shorts", meta: "Cotton · Summer" },
                  { top: "bg-neo-yellow", bg: "bg-neo-yellow-soft", label: "Bucket Hat", meta: "Canvas · Casual" },
                  { top: "bg-neo-lime", bg: "bg-neo-lime-soft", label: "Tote Bag", meta: "Leather · All-year" },
                ].map((item, i) => (
                  <div key={i} className="border-2 border-neo-border bg-neo-surface shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <div className={`relative aspect-square w-full ${item.bg} texture-crosshatch`}>
                      <div className={`absolute left-0 top-0 h-0.5 w-full ${item.top}`} />
                    </div>
                    <div className="border-t border-neo-border p-1.5">
                      <div className="text-[7px] font-extrabold uppercase text-neo-ink">{item.label}</div>
                      <div className="mt-0.5 text-[6px] font-bold text-neo-mute">{item.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* Upload mockup */}
      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-3xl scroll-reveal">
          <BrowserFrame url="styleme.app/upload">
            <MockNav active="upload" />
            <div className="bg-neo-bg p-4" style={{ backgroundImage: "linear-gradient(90deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px), linear-gradient(180deg, color-mix(in srgb, var(--neo-border) 4%, transparent) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              <div className="flex flex-col items-center gap-3">
                <div className="text-[11px] font-black uppercase tracking-tight text-neo-ink">How Upload Works</div>
                {/* Pipeline steps */}
                <div className="flex w-full items-center justify-center gap-1.5 sm:gap-3">
                  {[
                    { step: "1", label: "Upload Photo", icon: "bg-neo-blue" },
                    { step: "2", label: "Detect Garments", icon: "bg-neo-accent" },
                    { step: "3", label: "Analyze Details", icon: "bg-neo-yellow" },
                    { step: "4", label: "Wardrobe Ready", icon: "bg-neo-lime" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 sm:gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex h-7 w-7 items-center justify-center border-2 border-neo-border ${s.icon} shadow-[1px_1px_0_0_var(--neo-shadow)]`}>
                          <span className="text-[8px] font-black text-white">{s.step}</span>
                        </div>
                        <span className="text-[6px] font-extrabold uppercase text-neo-mute">{s.label}</span>
                      </div>
                      {i < 3 && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--neo-mute)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 -mt-3"><polyline points="9 18 15 12 9 6" /></svg>
                      )}
                    </div>
                  ))}
                </div>
                {/* Segmentation visual */}
                <div className="mt-2 grid w-full grid-cols-4 gap-2">
                  <div className="col-span-1 border-2 border-neo-border bg-neo-surface shadow-[2px_2px_0_0_var(--neo-shadow)]">
                    <div className="flex aspect-3/4 w-full items-center justify-center bg-neo-lavender texture-crosshatch">
                      <div className="flex flex-col items-center gap-0.5 opacity-60">
                        <div className="h-4 w-4 rounded-full bg-neo-peach" />
                        <div className="h-8 w-6 bg-neo-cyan-soft" />
                        <div className="h-5 w-7 bg-neo-yellow-soft" />
                        <div className="h-2 w-6 bg-neo-pink-soft" />
                      </div>
                    </div>
                    <div className="border-t border-neo-border p-1.5 text-center">
                      <span className="text-[7px] font-extrabold uppercase text-neo-mute">Original</span>
                    </div>
                  </div>
                  <div className="col-span-3 grid grid-cols-3 gap-2">
                    {[
                      { bg: "bg-neo-cyan-soft", label: "Shirt", tags: "Blue · Cotton · Casual" },
                      { bg: "bg-neo-yellow-soft", label: "Pants", tags: "Khaki · Twill · Smart" },
                      { bg: "bg-neo-pink-soft", label: "Sneakers", tags: "White · Leather · Casual" },
                    ].map((seg, i) => (
                      <div key={i} className="border-2 border-neo-border bg-neo-surface shadow-[1px_1px_0_0_var(--neo-shadow)]">
                        <div className={`aspect-square w-full ${seg.bg} texture-crosshatch`} />
                        <div className="border-t border-neo-border p-1">
                          <div className="text-[6px] font-extrabold uppercase text-neo-ink">{seg.label}</div>
                          <div className="mt-0.5 text-[5px] font-bold text-neo-mute">{seg.tags}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-neo-lime animate-pulse-soft" />
                  <span className="text-[7px] font-extrabold uppercase tracking-widest text-neo-mute">3 garments detected, analyzed, and stored</span>
                </div>
              </div>
            </div>
          </BrowserFrame>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="relative border-y-3 border-neo-border bg-neo-surface px-5 py-20 sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute inset-0 texture-dots" style={{ opacity: 0.4 }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="mb-14 text-center scroll-reveal">
            <h2 className="text-3xl font-black uppercase tracking-tight text-neo-ink sm:text-4xl">
              Four steps to{" "}
              <span className="inline-block -rotate-1 border-3 border-neo-border bg-neo-accent px-3 py-0.5 text-white shadow-[3px_3px_0_0_var(--neo-shadow)] hover-tilt">
                perfect
              </span>{" "}
              outfits
            </h2>
            <div className="mx-auto mt-5 h-[3px] w-24 bg-neo-yellow animate-draw-line" />
          </div>

          <div className="stagger grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.num} className="group relative flex flex-col gap-4 border-3 border-neo-border bg-neo-surface p-6 shadow-[4px_4px_0_0_var(--neo-shadow)] transition-all duration-200 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_var(--neo-shadow)]">
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 animate-shimmer" />
                <span className="text-5xl font-black uppercase text-neo-mute sm:text-6xl" style={{ opacity: 0.12 }}>{s.num}</span>
                <div className="flex items-center gap-3">
                  <div className={`h-3.5 w-3.5 border-2 border-neo-border ${s.accent} transition-transform group-hover:scale-125`} />
                  <h3 className="text-sm font-black uppercase tracking-tight text-neo-ink">{s.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-neo-mute">{s.desc}</p>
                {i === 0 && (
                  <div className="mt-1 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-neo-border bg-neo-pink-soft">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--neo-accent)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </div>
                    <div className="h-[2px] flex-1 bg-neo-accent" style={{ opacity: 0.3 }} />
                    <div className="flex h-6 w-6 items-center justify-center border-2 border-neo-border bg-neo-lime">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  </div>
                )}
                {i === 1 && (
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {[...Array(8)].map((_, j) => (
                      <div key={j} className={`aspect-square border border-neo-border ${j % 2 === 0 ? "bg-neo-cyan-soft" : "bg-neo-pink-soft"} texture-crosshatch`} />
                    ))}
                  </div>
                )}
                {i === 2 && (
                  <div className="mt-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-2 border-neo-border bg-neo-yellow-soft px-2 py-1 shadow-[1px_1px_0_0_var(--neo-shadow)]">
                        <span className="text-[8px] font-bold text-neo-ink">date night look</span>
                      </div>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--neo-mute)" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      <div className="flex gap-1">
                        <div className="h-5 w-5 border border-neo-border bg-neo-pink-soft" />
                        <div className="h-5 w-5 border border-neo-border bg-neo-cyan-soft" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border-2 border-neo-border bg-neo-cyan-soft px-2 py-1 shadow-[1px_1px_0_0_var(--neo-shadow)]">
                        <span className="text-[8px] font-bold text-neo-ink">jackets under $200</span>
                      </div>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--neo-mute)" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      <div className="flex items-center gap-0.5">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--neo-blue)" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                        <span className="text-[6px] font-bold text-neo-blue">Web</span>
                      </div>
                    </div>
                  </div>
                )}
                {i === 3 && (
                  <div className="mt-1 flex items-center justify-center">
                    <div className="border-2 border-neo-border bg-neo-lavender p-2 shadow-[2px_2px_0_0_var(--neo-shadow)]">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="h-3 w-3 rounded-full bg-neo-peach" />
                        <div className="h-5 w-4 bg-neo-cyan-soft" />
                        <div className="h-3 w-5 bg-neo-yellow-soft" />
                      </div>
                    </div>
                  </div>
                )}
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-4 top-1/2 hidden text-neo-mute lg:block">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t-3 border-neo-border px-5 py-20 sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute inset-0 texture-lines" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[20%] h-10 w-10 border-2 border-neo-yellow bg-neo-yellow-soft animate-float" />
          <div className="absolute bottom-[20%] right-[10%] h-8 w-8 rounded-full border-2 border-neo-accent bg-neo-pink-soft animate-float-alt" />
          <div className="absolute right-[30%] top-[15%] h-6 w-6 border-2 border-neo-blue bg-neo-cyan-soft animate-float-spin" style={{ animationDelay: "0.7s" }} />
          <div className="absolute left-[25%] bottom-[15%] h-5 w-5 rounded-full border-2 border-neo-lime bg-neo-lime-soft animate-wiggle" style={{ animationDelay: "1.2s" }} />
          <div className="absolute left-[45%] top-[10%] h-40 w-40 rounded-full border-3 border-dashed border-neo-mute animate-spin-slow" style={{ opacity: 0.08 }} />
        </div>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-8 text-center scroll-reveal">
          <div className="hover-jelly">
            <HangerIcon size={64} className="text-neo-ink" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-neo-ink sm:text-5xl">Ready to style smarter?</h2>
          <div className="h-[3px] w-20 bg-neo-accent" />
          <p className="max-w-md text-sm font-medium leading-relaxed text-neo-mute sm:text-base">Be the first to experience AI-powered styling. Join the waitlist and get early access when we launch.</p>
          <WaitlistButton className="neo-btn bg-neo-accent px-10 py-4 text-sm text-white animate-pulse-scale sm:text-base">Join Waitlist</WaitlistButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-3 border-neo-border bg-neo-surface px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <HangerIcon size={24} className="text-neo-ink" />
            <span className="text-sm font-black uppercase tracking-tight text-neo-ink underline-draw">
              Style<span className="text-neo-accent">Me</span>
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-neo-mute">AI-powered styling for your real wardrobe</p>
          <div className="flex h-1.5 w-20 overflow-hidden">
            <div className="flex-1 bg-neo-accent" />
            <div className="flex-1 bg-neo-yellow" />
            <div className="flex-1 bg-neo-blue" />
            <div className="flex-1 bg-neo-lime" />
          </div>
        </div>
      </footer>
    </div>
  );
}
