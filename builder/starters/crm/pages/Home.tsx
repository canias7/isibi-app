import { Link } from 'react-router-dom'
import Hero from '../components/Hero.tsx'
import FeatureGrid from '../components/FeatureGrid.tsx'
import HowItWorks from '../components/HowItWorks.tsx'
import FAQSection from '../components/FAQSection.tsx'
import CTASection from '../components/CTASection.tsx'
import Button from '../components/Button.tsx'
import { useAuth } from '../lib/auth.tsx'
import { KanbanSquare, Users, TrendingUp, Eye } from 'lucide-react'

// Landing page. An internal tool still needs a front door — someone has to be sold on it before they sign up —
// but anyone already signed in wants the pipeline, not the pitch, so the hero swaps its call to action.
export default function Home() {
  const { user } = useAuth()

  return (
    <>
      <Hero
        eyebrow="Sales CRM"
        title={user ? `Welcome back${user.display_name ? ', ' + user.display_name : ''}` : 'Every deal, in one place your team actually updates'}
        subtitle={user
          ? 'Your pipeline, your leads and your numbers are where you left them.'
          : 'Leads, deals and contacts without the twelve mandatory fields nobody fills in. Built for a team that would rather be selling.'}
        primaryCta={user ? { label: 'Open the dashboard', to: '/dashboard' } : { label: 'Get started', to: '/signin' }}
        secondaryCta={user ? { label: 'Go to pipeline', to: '/deals' } : { label: 'See how it works', to: '/signin' }}
        notes={['Reps own their records', 'Managers see the whole downline']}
        variant="center"
      />

      <FeatureGrid
        eyebrow="What you get"
        title="The four screens a sales team opens every day"
        features={[
          { icon: <Users size={20} />, title: 'Leads that get worked', body: 'Everything that came in, who owns it, and what happened last. Qualify or disqualify in one click.' },
          { icon: <KanbanSquare size={20} />, title: 'A pipeline you can drag', body: 'Deals move between stages by dragging the card. The stage rules are enforced, so nothing skips from discovery to won.' },
          { icon: <TrendingUp size={20} />, title: 'A forecast worth trusting', body: 'Weighted by each deal’s own probability, not by wishful thinking. Win rate is measured on closed deals only.' },
          { icon: <Eye size={20} />, title: 'Manager visibility, built in', body: 'A rep sees their own records. Their manager sees the whole downline, without anyone sharing a spreadsheet.' },
        ]}
      />

      <HowItWorks
        title="How a deal moves"
        steps={[
          { title: 'It arrives as a lead', body: 'From the website, a referral or an outbound list. Whoever picks it up owns it.' },
          { title: 'It gets qualified', body: 'Real budget, real timeline, real person. If not, mark it unqualified and move on.' },
          { title: 'It becomes a deal', body: 'On the board, with a value and a close date, moving through discovery, proposal and negotiation.' },
          { title: 'It closes', body: 'Won or lost, with the reason recorded. That is what makes next quarter’s forecast honest.' },
        ]}
      />

      <FAQSection
        items={[
          { title: 'Who can see my leads?', content: 'You, and anyone you report up to. Visibility follows the reporting line, so a manager sees their whole downline and a peer sees nothing of yours.' },
          { title: 'Can I move a deal straight to won?', content: 'No. A deal has to pass through negotiation first. The stage rules are enforced by the server, not just the interface, so the pipeline data stays meaningful.' },
          { title: 'What is the weighted figure on the dashboard?', content: 'Each open deal counted at its own probability rather than its full value, plus won deals in full. It is the number to forecast on.' },
          { title: 'What happens when I delete something?', content: 'It goes to the bin rather than disappearing, so a mis-click is recoverable.' },
        ]}
      />

      <CTASection
        title={user ? 'Back to work' : 'Start with your next lead'}
        subtitle={user ? undefined : 'No import, no setup call. Add one lead and see how it feels.'}
        primaryCta={user ? { label: 'Open the dashboard', to: '/dashboard' } : { label: 'Create an account', to: '/signin' }}
        tone="brand"
      />
    </>
  )
}
