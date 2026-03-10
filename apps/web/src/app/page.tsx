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
  Layers3,
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
import styles from './page.module.css'

export const metadata: Metadata = {
  title: 'PITCH | IBM-Sponsored Capstone',
  description:
    'PITCH is an IBM-sponsored University of Calgary capstone project built by six students to help clients improve sales readiness through AI-powered pitch rehearsal.',
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
  { href: '#problem', label: 'Client Pain' },
  { href: '#solution', label: 'Solution' },
  { href: '#analytics', label: 'Analytics' },
  { href: '#screens', label: 'Screens' },
  { href: '#capstone', label: 'Capstone' },
  { href: '#team', label: 'Team' },
  { href: '#github', label: 'GitHub' },
]

const heroStats = [
  { label: 'Conversation Simulations', value: '1.2M+' },
  { label: 'Faster Ramp Time', value: '38%' },
  { label: 'Win-Confidence Lift', value: '24%' },
  { label: 'Coach Satisfaction', value: '4.9/5' },
]

const clientPain = [
  {
    title: 'Slow Onboarding',
    description: 'New reps take too long to reach confident, customer-ready performance.',
    icon: Rocket,
  },
  {
    title: 'Inconsistent Coaching',
    description: 'Feedback quality varies by manager and is hard to scale across teams.',
    icon: Users,
  },
  {
    title: 'No Readiness Signal',
    description: 'Leaders lack measurable evidence that reps are prepared for high-stakes calls.',
    icon: LineChart,
  },
]

const outcomes = [
  {
    title: 'Client Impact',
    points: [
      'Shorter time-to-readiness for new sales hires',
      'Standardized coaching quality across managers',
      'Clear dashboards for leadership decisions',
    ],
  },
  {
    title: 'Business Value',
    points: [
      'Lower enablement cost per rep',
      'More consistent customer conversation quality',
      'Better confidence before live revenue calls',
    ],
  },
]

const solutionPillars = [
  {
    title: 'AI Persona Simulations',
    description:
      'Practice against realistic buyer personalities that challenge value messaging, objection handling, and deal strategy.',
    icon: BrainCircuit,
  },
  {
    title: 'Real-Time Coaching Signals',
    description:
      'Track talk ratio, narrative clarity, and objection handling quality while the conversation is still in progress.',
    icon: Zap,
  },
  {
    title: 'Manager Analytics Layer',
    description:
      'View readiness trends, rep-level gaps, and team-wide progress with actionable coaching recommendations.',
    icon: BarChart3,
  },
  {
    title: 'Secure Team Operations',
    description:
      'Support role controls, structured workflows, and auditable simulation history suitable for client environments.',
    icon: ShieldCheck,
  },
]

const workflowSteps = [
  {
    title: 'Define Scenario',
    text: 'Configure sales stage, buyer pressure, and evaluation rubric to mirror real client conversations.',
  },
  {
    title: 'Run Rehearsal',
    text: 'Reps practice live while PITCH tracks communication quality and coaching opportunities.',
  },
  {
    title: 'Coach and Improve',
    text: 'Managers review metrics, assign targeted drills, and measure improvement over time.',
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

const screenshotCards = [
  {
    title: 'Executive Dashboard',
    detail: 'A clear view of team readiness, progress velocity, and coaching priorities.',
  },
  {
    title: 'Live Rehearsal Studio',
    detail: 'Interactive simulation with AI coach feedback and transcript intelligence.',
  },
  {
    title: 'Scenario Builder',
    detail: 'Configure role-specific training journeys and standardized quality checkpoints.',
  },
]

const capstoneFacts = [
  {
    title: 'IBM Sponsored',
    detail: 'Developed with IBM-backed capstone support and industry-aligned mentorship.',
    icon: Building2,
  },
  {
    title: 'University of Calgary',
    detail: 'Built as a multidisciplinary capstone at the University of Calgary in 2026.',
    icon: GraduationCap,
  },
  {
    title: '6-Student Delivery Team',
    detail: 'A focused product team covering UX, frontend, backend, AI, data, and testing.',
    icon: Users,
  },
]

const goToMarket = [
  {
    title: 'Client Discovery',
    text: 'Align with client goals, sales process maturity, and current coaching constraints.',
  },
  {
    title: 'Pilot Execution',
    text: 'Run a guided pilot with selected teams and track readiness uplift metrics.',
  },
  {
    title: 'Scale Adoption',
    text: 'Expand with playbook templates, manager enablement, and ongoing analytics review.',
  },
]

const teamPods = [
  {
    role: 'Product Strategy',
    focus: 'Client outcomes, roadmap alignment, and business-value positioning.',
  },
  {
    role: 'Frontend Experience',
    focus: 'High-fidelity UI system and responsive interaction design.',
  },
  {
    role: 'Backend Architecture',
    focus: 'Service orchestration, API reliability, and platform scalability.',
  },
  {
    role: 'AI and Prompt Systems',
    focus: 'Persona behavior quality and coaching-feedback relevance.',
  },
  {
    role: 'Data and Analytics',
    focus: 'Signal modeling, score interpretation, and trend visibility.',
  },
  {
    role: 'QA and DevOps',
    focus: 'Test automation, deployment stability, and release confidence.',
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
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            PITCH<span className={styles.brandDot}>.</span>
          </Link>

          <nav className={styles.nav}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <Link href={GITHUB_URL} target="_blank" rel="noreferrer" className={styles.headerGhost}>
              <Github size={15} /> GitHub
            </Link>
            <Link href="/auth/register" className={styles.headerPrimary}>
              Try it out
            </Link>
          </div>
        </header>

        <section id="overview" className={`${styles.screen} ${styles.screenHero}`}>
          <div className={styles.screenInner}>
            <div className={styles.heroGrid}>
              <div className={`${styles.heroCopy} ${styles.reveal}`} style={withDelay('0.08s')}>
                <p className={styles.kicker}>
                  IBM Sponsored • UCalgary Capstone • 6 Student Builders
                </p>
                <h1 className={styles.heroTitle}>
                  An AI rehearsal platform that helps clients coach sales teams with confidence.
                </h1>
                <p className={styles.heroText}>
                  PITCH is a capstone product designed to help clients improve rep readiness,
                  standardize coaching quality, and gain measurable performance signals before live
                  customer calls.
                </p>
                <div className={styles.heroActions}>
                  <Link href="/auth/register" className={styles.primaryButton}>
                    Book Client Walkthrough <ArrowRight size={17} />
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
              </div>

              <aside className={`${styles.heroPanel} ${styles.reveal}`} style={withDelay('0.16s')}>
                <p className={styles.ibmLabel}>Sponsored by</p>
                <img src="/IBM.png" alt="IBM Logo" className={styles.ibmLogo} />
                <p className={styles.ibmText}>
                  Industry-supported innovation for a real client coaching challenge.
                </p>

                <div className={styles.statGrid}>
                  {heroStats.map((item) => (
                    <article key={item.label}>
                      <p>{item.value}</p>
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
              <p className={styles.sectionKicker}>Client Problem</p>
              <h2>Why clients need a better rehearsal system</h2>
              <p>
                Traditional role-play is inconsistent, hard to measure, and difficult to scale.
                PITCH addresses this with structured AI simulations and transparent coaching
                analytics.
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
              <p className={styles.sectionKicker}>Solution Design</p>
              <h2>Built for practical, measurable client adoption</h2>
              <p>
                PITCH combines simulation quality, coaching intelligence, and clean reporting so
                clients can make faster enablement decisions with less ambiguity.
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
                  <Workflow size={17} /> Client Workflow
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
              <h2>Dedicated reporting screen for client stakeholders</h2>
              <p>
                Visualize readiness progress and confidence growth over time, then compare pre- and
                post-coaching outcomes for each key sales competency.
              </p>
            </div>

            <div className={styles.analyticsLayout}>
              <article
                className={`${styles.chartCard} ${styles.reveal}`}
                style={withDelay('0.12s')}
              >
                <div className={styles.chartHead}>
                  <div>
                    <p>Team Readiness Trend</p>
                    <small>6-month pilot cohort</small>
                  </div>
                  <span>
                    <TrendingUp size={14} /> +19% readiness momentum
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
                        <stop offset="0%" stopColor="rgba(15, 98, 254, 0.38)" />
                        <stop offset="100%" stopColor="rgba(15, 98, 254, 0.04)" />
                      </linearGradient>
                      <linearGradient id="readiness-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#0f62fe" />
                        <stop offset="100%" stopColor="#4cc9f0" />
                      </linearGradient>
                      <linearGradient id="confidence-line" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ffd166" />
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
                  <Target size={16} /> Before vs After Coaching
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

        <section id="screens" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Dedicated Product Screens</p>
              <h2>Each product section has its own clear interface focus</h2>
              <p>
                Designed for high clarity in demos: one screen for leadership visibility, one for
                live rehearsal, and one for scenario setup and control.
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
                  <p>{screenshotCards[0].title}</p>
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
                <p>{screenshotCards[0].detail}</p>
              </article>

              <article
                className={`${styles.screenCard} ${styles.reveal}`}
                style={withDelay('0.18s')}
              >
                <header>
                  <span />
                  <span />
                  <span />
                  <p>{screenshotCards[1].title}</p>
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
                <p>{screenshotCards[1].detail}</p>
              </article>

              <article
                className={`${styles.screenCard} ${styles.reveal}`}
                style={withDelay('0.24s')}
              >
                <header>
                  <span />
                  <span />
                  <span />
                  <p>{screenshotCards[2].title}</p>
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
                <p>{screenshotCards[2].detail}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="capstone" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>Capstone Credibility</p>
              <h2>Built as an IBM-sponsored University of Calgary capstone</h2>
              <p>
                This project combines academic rigor with practical client strategy: clear outcomes,
                pilot structure, and measurable rollout planning.
              </p>
            </div>

            <div className={styles.capstoneLayout}>
              <div className={styles.factGrid}>
                {capstoneFacts.map((fact, index) => {
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

              <aside
                className={`${styles.strategyCard} ${styles.reveal}`}
                style={withDelay('0.22s')}
              >
                <h3>
                  <Layers3 size={16} /> Marketing and Adoption Strategy
                </h3>
                <ol>
                  {goToMarket.map((phase) => (
                    <li key={phase.title}>
                      <h4>{phase.title}</h4>
                      <p>{phase.text}</p>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </div>
        </section>

        <section id="team" className={styles.screen}>
          <div className={styles.screenInner}>
            <div className={`${styles.sectionIntro} ${styles.reveal}`} style={withDelay('0.06s')}>
              <p className={styles.sectionKicker}>The Team</p>
              <h2>Built by 6 University of Calgary students</h2>
              <p>
                A six-person capstone team collaborated across product strategy, design,
                engineering, AI, and delivery quality.
              </p>
            </div>

            <div className={styles.teamGrid}>
              {teamPods.map((member, index) => (
                <article
                  key={member.role}
                  className={`${styles.teamCard} ${styles.reveal}`}
                  style={withDelay(`${0.12 + index * 0.06}s`)}
                >
                  <h3>{member.role}</h3>
                  <p>{member.focus}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="github" className={`${styles.screen} ${styles.screenFinal}`}>
          <div className={styles.screenInner}>
            <div className={`${styles.finalCard} ${styles.reveal}`} style={withDelay('0.08s')}>
              <p className={styles.sectionKicker}>Open Project Access</p>
              <h2>Explore the code, architecture, and progress on GitHub</h2>
              <p>
                PITCH is presented as a client-ready capstone platform with transparent engineering
                delivery. Review source code, open issues, and implementation details.
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
              <p>© {year} PITCH Capstone Project</p>
              <p>IBM Sponsored • University of Calgary • PITCH Team</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
  )
}
