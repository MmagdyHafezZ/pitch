import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Manrope, Space_Grotesk } from 'next/font/google'
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ExternalLink,
  Github,
  GraduationCap,
  LineChart,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { Counter } from '@/components/marketing/Counter'
import { PillNav } from '@/components/marketing/PillNav'
import { StarBorder } from '@/components/marketing/StarBorder'
import { LandingBackground } from './LandingBackground'
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'PITCH | IBM-Sponsored Capstone',
  description:
    'PITCH is an IBM-sponsored University of Calgary capstone focused on AI-powered sales rehearsal, coaching, and readiness analytics.',
}

const headingFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-heading',
})

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
})

const GITHUB_URL = 'https://github.com/MmagdyHafezZ/PITCH'
const GITHUB_ISSUES_URL = 'https://github.com/MmagdyHafezZ/PITCH/issues'

const navLinks = [
  { href: '#overview', label: 'Overview' },
  { href: '#problem', label: 'Problem' },
  { href: '#solution', label: 'Solution' },
  { href: '#analytics', label: 'Analytics' },
  { href: '#examples', label: 'Examples' },
  { href: '#team', label: 'The Team' },
  { href: '#github', label: 'GitHub' },
]

const heroStats = [
  { label: 'Active users', value: 1284, suffix: '+' },
  { label: 'Live sessions', value: 86 },
  { label: 'Team workspaces', value: 24 },
  { label: 'Rehearsals this week', value: 3127, suffix: '+' },
]

const heroSignals = [
  'Realistic buyer personas',
  'Live coaching insights',
  'Manager-ready reporting',
]

const clientPain = [
  {
    title: 'Ramp-up takes too long',
    description:
      'New reps need repeated practice before they can handle objections and buying pressure with confidence.',
    icon: Rocket,
  },
  {
    title: 'Coaching quality varies',
    description:
      'Every manager runs practice differently, so feedback becomes difficult to standardize across the team.',
    icon: Users,
  },
  {
    title: 'Readiness is hard to prove',
    description:
      'Leaders can see activity, but they still lack a clear signal that a rep is ready for a high-stakes conversation.',
    icon: LineChart,
  },
]

const outcomes = [
  {
    title: 'Client Impact',
    points: [
      'Faster ramp time for new sellers',
      'More consistent coaching across managers',
      'Clearer readiness signals before customer calls',
    ],
  },
  {
    title: 'Business Value',
    points: [
      'Less manual effort for enablement teams',
      'Higher-quality practice at scale',
      'Better visibility into where coaching is paying off',
    ],
  },
]

const solutionPillars = [
  {
    title: 'Realistic AI buyer personas',
    description:
      'Give reps a believable environment to practice discovery, objection handling, and deal positioning before a live call.',
    icon: BrainCircuit,
  },
  {
    title: 'Live coaching signals',
    description:
      'Measure talk balance, clarity, and objection handling while the session is happening, not hours later.',
    icon: Zap,
  },
  {
    title: 'Manager-ready analytics',
    description:
      'Surface readiness trends, skill gaps, and coaching opportunities in a format leaders can actually use.',
    icon: BarChart3,
  },
  {
    title: 'Structured team workflows',
    description:
      'Support reusable scenarios, clear operating controls, and auditable session history for client teams.',
    icon: ShieldCheck,
  },
]

const workflowSteps = [
  {
    title: 'Set the scenario',
    text: 'Choose the buyer, stage, pressure, and rubric so the practice session matches a real customer conversation.',
  },
  {
    title: 'Run the rehearsal',
    text: 'Reps practice live while PITCH tracks communication quality and surfaces coaching signals in real time.',
  },
  {
    title: 'Review and coach',
    text: 'Managers review metrics, assign targeted follow-up, and measure improvement over time.',
  },
]

const trendSeries = [
  { label: 'Jan', readiness: 46, confidence: 34 },
  { label: 'Feb', readiness: 54, confidence: 39 },
  { label: 'Mar', readiness: 61, confidence: 45 },
  { label: 'Apr', readiness: 69, confidence: 51 },
  { label: 'May', readiness: 77, confidence: 58 },
  { label: 'Jun', readiness: 86, confidence: 64 },
]

const improvementBars = [
  { label: 'Discovery Quality', before: 49, after: 83 },
  { label: 'Narrative Clarity', before: 53, after: 87 },
  { label: 'Objection Handling', before: 46, after: 81 },
]

const exampleCards = [
  {
    title: 'Leadership dashboard',
    detail:
      'A quick view of readiness, improvement velocity, and the coaching priorities that matter most.',
  },
  {
    title: 'Live practice session',
    detail:
      'An interactive simulation with AI feedback, transcript context, and in-the-moment coaching prompts.',
  },
  {
    title: 'Scenario setup',
    detail:
      'Configure buyer context, pressure, and evaluation criteria for repeatable team-wide practice.',
  },
]

const teamHighlights = [
  {
    title: 'IBM Sponsored',
    detail: 'Built with IBM-backed sponsorship and mentorship around a real coaching workflow.',
    icon: Building2,
  },
  {
    title: 'University of Calgary',
    detail: 'Delivered as a multidisciplinary University of Calgary capstone in 2026.',
    icon: GraduationCap,
  },
  {
    title: '6-Student Delivery Team',
    detail: 'A focused team spanning product, frontend, backend, AI, analytics, and QA.',
    icon: Users,
  },
]

const teamPods = [
  {
    role: 'Product Strategy',
    focus: 'Translate client needs into roadmap priorities, positioning, and measurable outcomes.',
  },
  {
    role: 'Frontend Experience',
    focus:
      'Design and build the interface system across the landing site, studio, and rehearsal flows.',
  },
  {
    role: 'Backend Architecture',
    focus:
      'Own APIs, orchestration, and reliability for the platform’s real-time simulation features.',
  },
  {
    role: 'AI and Prompt Systems',
    focus:
      'Shape persona behavior, guidance logic, and response quality inside live practice sessions.',
  },
  {
    role: 'Data and Analytics',
    focus: 'Define metrics, scoring, and reporting patterns for reps, managers, and stakeholders.',
  },
  {
    role: 'QA and DevOps',
    focus:
      'Cover release confidence, test automation, and the path from local build to deployed product.',
  },
]

const chartWidth = 560
const chartHeight = 260
const chartPaddingX = 20
const chartPaddingY = 22
const chartScaleMax = 100

const plotWidth = chartWidth - chartPaddingX * 2
const plotHeight = chartHeight - chartPaddingY * 2

const getPoint = (index: number, value: number) => {
  const step = plotWidth / (trendSeries.length - 1)
  const x = chartPaddingX + step * index
  const y = chartHeight - chartPaddingY - (value / chartScaleMax) * plotHeight
  return { x, y }
}

const linePath = (key: 'readiness' | 'confidence') =>
  trendSeries
    .map((entry, index) => {
      const point = getPoint(index, entry[key])
      return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    })
    .join(' ')

const readinessPath = linePath('readiness')
const confidencePath = linePath('confidence')
const firstPoint = getPoint(0, trendSeries[0].readiness)
const lastPoint = getPoint(trendSeries.length - 1, trendSeries[trendSeries.length - 1].readiness)
const readinessAreaPath = `${readinessPath} L ${lastPoint.x} ${chartHeight - chartPaddingY} L ${firstPoint.x} ${chartHeight - chartPaddingY} Z`

const withDelay = (delay: string): CSSProperties => ({ '--delay': delay }) as CSSProperties

export default function Home() {
  const year = new Date().getFullYear()

  return (
    <main className={`${styles.page} ${headingFont.variable} ${bodyFont.variable}`}>
      <LandingBackground />
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            PITCH<span className={styles.brandDot}>.</span>
          </Link>

          <PillNav items={navLinks} className={styles.headerPillNav} />

          <div className={styles.headerActions}>
            <Link href={GITHUB_URL} target="_blank" rel="noreferrer" className={styles.headerGhost}>
              <Github size={15} /> GitHub
            </Link>
            <StarBorder
              as={Link}
              href="/auth/register"
              color="rgba(150, 221, 255, 0.95)"
              speed="4.8s"
              thickness={1.2}
              className={styles.headerStarCta}
              innerClassName={styles.headerStarInner}
            >
              Try it out
            </StarBorder>
          </div>
        </header>

        <section id="overview" className={`${styles.screen} ${styles.screenHero}`}>
          <div className={styles.screenInner}>
            <div className={styles.heroGrid}>
              <div className={`${styles.heroCopy} ${styles.reveal}`} style={withDelay('0.08s')}>
                <p className={styles.kicker}>
                  IBM-sponsored capstone • University of Calgary • Built by 6 students
                </p>
                <h1 className={styles.heroTitle}>
                  AI sales rehearsal for teams that need consistent coaching.
                </h1>
                <p className={styles.heroText}>
                  PITCH helps teams rehearse difficult buyer conversations, measure rep readiness,
                  and give managers a clearer view of where coaching is working before live customer
                  calls happen.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/auth/register" className={styles.primaryButton}>
                    Request a walkthrough <ArrowRight size={17} />
                  </Link>
                  <Link
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.secondaryButton}
                  >
                    <Github size={17} /> View Source
                  </Link>
                </div>
                <div className={styles.heroSignals}>
                  {heroSignals.map((signal) => (
                    <span key={signal}>{signal}</span>
                  ))}
                </div>
              </div>

              <aside className={`${styles.heroPanel} ${styles.reveal}`} style={withDelay('0.16s')}>
                <p className={styles.ibmLabel}>Sponsored by</p>
                <img src="/IBM.png" alt="IBM Logo" className={styles.ibmLogo} />
                <p className={styles.ibmText}>
                  Built with IBM-backed mentorship around a real coaching problem: helping teams
                  practice better before live customer conversations.
                </p>
                <p className={styles.metricLabel}>Current activity</p>

                <div className={styles.statGrid}>
                  {heroStats.map((item) => (
                    <article key={item.label}>
                      <p className={styles.statValue}>
                        <Counter
                          value={item.value}
                          suffix={item.suffix}
                          fontSize={24}
                          padding={2}
                          gap={2}
                          horizontalPadding={0}
                          fontWeight={700}
                          textColor="#f7fbff"
                          gradientHeight={18}
                          gradientFrom="rgba(5, 10, 27, 0.92)"
                          gradientTo="rgba(5, 10, 27, 0)"
                          counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
                        />
                      </p>
                      <span>{item.label}</span>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="problem" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Problem</p>
              <h2>Sales coaching still breaks down when teams try to scale it</h2>
              <p>
                Most sales teams still depend on ad hoc role-play, manager availability, and manual
                follow-up. That makes readiness inconsistent, coaching uneven, and improvement hard
                to measure.
              </p>
            </div>

            <div className={styles.problemLayout}>
              <div className={styles.problemGrid}>
                {clientPain.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <article
                      key={item.title}
                      className={`${styles.problemCard} ${styles.reveal}`}
                      style={withDelay(`${0.12 + index * 0.08}s`)}
                    >
                      <span>
                        <Icon size={18} />
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </article>
                  )
                })}
              </div>

              <div className={styles.outcomeGrid}>
                {outcomes.map((group, index) => (
                  <article
                    key={group.title}
                    className={`${styles.outcomeCard} ${styles.reveal}`}
                    style={withDelay(`${0.18 + index * 0.1}s`)}
                  >
                    <h3>{group.title}</h3>
                    <ul>
                      {group.points.map((point) => (
                        <li key={point}>
                          <CheckCircle2 size={14} /> {point}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="solution" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Solution</p>
              <h2>One workflow for practice, coaching, and review</h2>
              <p>
                PITCH brings together scenario design, live simulations, and manager-ready reporting
                so teams can coach with more consistency and less guesswork.
              </p>
            </div>

            <div className={styles.solutionLayout}>
              <div className={styles.pillarGrid}>
                {solutionPillars.map((pillar, index) => {
                  const Icon = pillar.icon
                  return (
                    <article
                      key={pillar.title}
                      className={`${styles.pillarCard} ${styles.reveal}`}
                      style={withDelay(`${0.12 + index * 0.07}s`)}
                    >
                      <span>
                        <Icon size={18} />
                      </span>
                      <h3>{pillar.title}</h3>
                      <p>{pillar.description}</p>
                    </article>
                  )
                })}
              </div>

              <aside
                className={`${styles.workflowCard} ${styles.reveal}`}
                style={withDelay('0.22s')}
              >
                <h3>
                  <Workflow size={17} /> How it works
                </h3>
                <ol>
                  {workflowSteps.map((step) => (
                    <li key={step.title}>
                      <h4>{step.title}</h4>
                      <p>{step.text}</p>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>
        </section>

        <section id="analytics" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Analytics</p>
              <h2>Reporting that shows whether coaching is actually working</h2>
              <p>
                Track readiness trends, confidence growth, and before-versus-after changes in the
                behaviors clients care about most.
              </p>
            </div>

            <div className={styles.analyticsLayout}>
              <article
                className={`${styles.chartCard} ${styles.reveal}`}
                style={withDelay('0.12s')}
              >
                <div className={styles.chartHead}>
                  <div>
                    <p>Readiness trend</p>
                    <small>6-month pilot cohort</small>
                  </div>
                  <span>
                    <TrendingUp size={14} /> +19% improvement trend
                  </span>
                </div>

                <div className={styles.chartWrap}>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className={styles.chartSvg}
                    role="img"
                    aria-label="Readiness and confidence trend chart"
                  >
                    <defs>
                      <linearGradient id="readiness-fill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(93, 103, 255, 0.34)" />
                        <stop offset="100%" stopColor="rgba(93, 103, 255, 0.04)" />
                      </linearGradient>
                      <linearGradient id="readiness-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#5d67ff" />
                        <stop offset="100%" stopColor="#96ddff" />
                      </linearGradient>
                      <linearGradient id="confidence-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#9c8dff" />
                        <stop offset="100%" stopColor="#dce2ff" />
                      </linearGradient>
                    </defs>

                    {[0, 25, 50, 75, 100].map((tick) => {
                      const y = chartHeight - chartPaddingY - (tick / chartScaleMax) * plotHeight
                      return (
                        <line
                          key={tick}
                          x1={chartPaddingX}
                          x2={chartWidth - chartPaddingX}
                          y1={y}
                          y2={y}
                          className={styles.chartGrid}
                        />
                      )
                    })}

                    <path
                      d={readinessAreaPath}
                      fill="url(#readiness-fill)"
                      className={styles.areaPath}
                    />
                    <path
                      d={readinessPath}
                      className={styles.lineA}
                      stroke="url(#readiness-line)"
                    />
                    <path
                      d={confidencePath}
                      className={styles.lineB}
                      stroke="url(#confidence-line)"
                    />

                    {trendSeries.map((entry, index) => {
                      const a = getPoint(index, entry.readiness)
                      const b = getPoint(index, entry.confidence)
                      return (
                        <g key={entry.label}>
                          <circle cx={a.x} cy={a.y} r="3.8" className={styles.pointA} />
                          <circle cx={b.x} cy={b.y} r="3.4" className={styles.pointB} />
                        </g>
                      )
                    })}
                  </svg>

                  <div className={styles.months}>
                    {trendSeries.map((item) => (
                      <span key={item.label}>{item.label}</span>
                    ))}
                  </div>
                </div>
              </article>

              <aside className={`${styles.deltaCard} ${styles.reveal}`} style={withDelay('0.2s')}>
                <h3>
                  <Target size={16} /> Coaching impact by skill
                </h3>
                <ul>
                  {improvementBars.map((metric, index) => (
                    <li key={metric.label}>
                      <p>{metric.label}</p>
                      <div className={styles.deltaBars}>
                        <div className={styles.beforeBar}>
                          <span
                            style={{
                              width: `${metric.before}%`,
                              animationDelay: `${0.25 + index * 0.08}s`,
                            }}
                          />
                        </div>
                        <div className={styles.afterBar}>
                          <span
                            style={{
                              width: `${metric.after}%`,
                              animationDelay: `${0.38 + index * 0.08}s`,
                            }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="examples" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Examples</p>
              <h2>Examples of the product in action</h2>
              <p>
                These views show how PITCH supports leaders, reps, and scenario designers during a
                complete coaching cycle.
              </p>
            </div>

            <div className={styles.screensGrid}>
              <article
                className={`${styles.screenCard} ${styles.reveal}`}
                style={withDelay('0.12s')}
              >
                <header>
                  <span />
                  <span />
                  <span />
                  <p>{exampleCards[0].title}</p>
                </header>
                <div className={styles.mockDashboard}>
                  <div className={styles.mockSidebar}>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.mockContent}>
                    <div className={styles.mockHeader} />
                    <div className={styles.mockBars}>
                      {[72, 47, 85, 62, 77].map((height) => (
                        <span key={height} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
                <p>{exampleCards[0].detail}</p>
              </article>

              <article
                className={`${styles.screenCard} ${styles.reveal}`}
                style={withDelay('0.18s')}
              >
                <header>
                  <span />
                  <span />
                  <span />
                  <p>{exampleCards[1].title}</p>
                </header>
                <div className={styles.mockLive}>
                  <div className={styles.liveMedia}>
                    <Image
                      src="/pitchMascot.png"
                      alt="PITCH AI coach preview"
                      fill
                      sizes="(max-width: 900px) 100vw, 33vw"
                      className={styles.liveImage}
                    />
                    <em>Live AI Coach</em>
                  </div>
                  <ul>
                    <li>Rep: How is your team managing renewal risk right now?</li>
                    <li>Buyer: We need stronger ROI proof before committing budget.</li>
                    <li>Coach: Good discovery. Quantify business impact next.</li>
                  </ul>
                </div>
                <p>{exampleCards[1].detail}</p>
              </article>

              <article
                className={`${styles.screenCard} ${styles.reveal}`}
                style={withDelay('0.24s')}
              >
                <header>
                  <span />
                  <span />
                  <span />
                  <p>{exampleCards[2].title}</p>
                </header>
                <div className={styles.mockBuilder}>
                  <div>
                    <small>Persona</small>
                    <span>CFO • Enterprise SaaS</span>
                  </div>
                  <div>
                    <small>Pressure</small>
                    <span>Budget freeze + legal review</span>
                  </div>
                  <ul>
                    <li>
                      <CheckCircle2 size={14} /> Discovery depth
                    </li>
                    <li>
                      <CheckCircle2 size={14} /> Stakeholder mapping
                    </li>
                    <li>
                      <CheckCircle2 size={14} /> Objection structure
                    </li>
                  </ul>
                </div>
                <p>{exampleCards[2].detail}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="team" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>The Team</p>
              <h2>Built by a six-student team with IBM-backed sponsorship</h2>
              <p>
                PITCH was built as a multidisciplinary capstone spanning product strategy, design,
                engineering, AI, analytics, and delivery quality.
              </p>
            </div>

            <div className={styles.teamSectionStack}>
              <div className={styles.factGrid}>
                {teamHighlights.map((fact, index) => {
                  const Icon = fact.icon
                  return (
                    <article
                      key={fact.title}
                      className={`${styles.factCard} ${styles.reveal}`}
                      style={withDelay(`${0.12 + index * 0.08}s`)}
                    >
                      <span>
                        <Icon size={18} />
                      </span>
                      <h3>{fact.title}</h3>
                      <p>{fact.detail}</p>
                    </article>
                  )
                })}
              </div>

              <div className={styles.teamGrid}>
                {teamPods.map((member, index) => (
                  <article
                    key={member.role}
                    className={`${styles.teamCard} ${styles.reveal}`}
                    style={withDelay(`${0.18 + index * 0.06}s`)}
                  >
                    <h3>{member.role}</h3>
                    <p>{member.focus}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="github" className={`${styles.screen} ${styles.screenFinal}`}>
          <div className={styles.screenInner}>
            <div className={`${styles.finalCard} ${styles.reveal}`} style={withDelay('0.08s')}>
              <p className={styles.sectionKicker}>GitHub</p>
              <h2>See the code, architecture, and delivery history</h2>
              <p>
                The repository shows how the product was built: frontend work, API orchestration,
                AI-driven simulation flows, tests, and the issues used to track progress.
              </p>

              <div className={styles.finalActions}>
                <Link
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.primaryButton}
                >
                  <Github size={17} /> Open GitHub <ExternalLink size={15} />
                </Link>
                <Link
                  href={GITHUB_ISSUES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.secondaryButton}
                >
                  <Sparkles size={17} /> View Issues
                </Link>
              </div>
            </div>

            <footer className={styles.footer}>
              <p>© {year} PITCH</p>
              <p>IBM-sponsored University of Calgary capstone</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  )
}
