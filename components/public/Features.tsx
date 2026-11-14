import { Captions, HeartHandshake, ListChecks, Smile, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

const FEATURES = [
  { icon: Smile, title: "Friendly presenters", text: "Ollie, Maryam, Yusuf, Robo and Sheru guide every lesson with a warm voice, blinking eyes and big smiles.", tone: "from-violet-500/30 text-violet-300" },
  { icon: Sparkles, title: "Picture-first teaching", text: "Bright visuals, counting objects and step-by-step animations turn tricky ideas into “aha!” moments.", tone: "from-fuchsia-500/30 text-fuchsia-300" },
  { icon: ListChecks, title: "Quizzes that talk back", text: "Pause-and-think countdowns and quick quizzes help children practise and remember.", tone: "from-cyan-400/30 text-cyan-300" },
  { icon: HeartHandshake, title: "Islamic values", text: "Gentle connections to the Quran, Seerah and good character — naturally, never forced.", tone: "from-emerald-400/30 text-emerald-300" },
  { icon: Captions, title: "Captions on every video", text: "Clear on-screen captions support early readers and children learning English.", tone: "from-amber-400/30 text-amber-300" },
];

export function Features() {
  return (
    <section id="how" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How we teach</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
            Made by teachers, <span className="text-gradient">loved by kids</span>
          </h2>
          <p className="mt-3 text-fg-muted">Every lesson follows the same proven rhythm: hook, explain, practise, remember.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="card card-hover relative h-full overflow-hidden p-6">
                <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl ${f.tone}`} />
                <div className={`relative grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 ${f.tone.split(" ")[1]}`}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="relative mt-5 text-base font-semibold text-fg">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-fg-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
