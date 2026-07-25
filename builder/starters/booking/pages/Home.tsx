import Hero from '../components/Hero.tsx'
import FeatureGrid from '../components/FeatureGrid.tsx'
import HowItWorks from '../components/HowItWorks.tsx'
import TestimonialGrid from '../components/TestimonialGrid.tsx'
import FAQSection from '../components/FAQSection.tsx'
import CTASection from '../components/CTASection.tsx'
import { CalendarCheck, Clock, ShieldCheck, Sparkles } from 'lucide-react'

// Landing page. Everything below is placeholder copy for a generic appointment business — the adapt step
// rewrites it for the real one. The SECTIONS are the part worth keeping: hero, what you get, how it works,
// proof, questions, close.
export default function Home() {
  return (
    <>
      <Hero
        eyebrow="Now taking bookings"
        title="Book your next appointment in under a minute"
        subtitle="Pick a service, choose a time that suits you, and you're done. No phone calls, no waiting on hold."
        primaryCta={{ label: 'Book now', to: '/book' }}
        secondaryCta={{ label: 'See services', to: '/services' }}
        notes={['Free cancellation up to 24h before', 'Instant confirmation']}
        media={<img src="@@IMG:a warm, welcoming appointment studio interior, natural light, soft focus@@" alt="" className="w-full rounded-xl2 object-cover" />}
      />

      <FeatureGrid
        eyebrow="Why book online"
        title="Everything handled before you arrive"
        features={[
          { icon: <CalendarCheck size={20} />, title: 'Real availability', body: 'You only ever see times that are genuinely free — no double bookings, no callbacks to rearrange.' },
          { icon: <Clock size={20} />, title: 'Booked in a minute', body: 'Three taps from the home page to a confirmed appointment, on your phone, at any hour.' },
          { icon: <ShieldCheck size={20} />, title: 'Change it yourself', body: 'Cancel or rebook from your own account up to 24 hours before, without having to ask.' },
          { icon: <Sparkles size={20} />, title: 'We remember you', body: 'Your details and history are saved, so your next booking takes even less time than the first.' },
        ]}
      />

      <HowItWorks
        title="How it works"
        steps={[
          { title: 'Choose a service', body: 'Browse what we offer, with the length and the price shown up front.' },
          { title: 'Pick your time', body: 'Choose a day, then a slot. Only genuinely available times are shown.' },
          { title: 'Turn up', body: 'You get a confirmation straight away and can manage the booking from your account.' },
        ]}
      />

      <TestimonialGrid
        title="What people say"
        items={[
          { quote: 'Booked at eleven at night, got a slot for the next morning. This is how it should work everywhere.', author: 'Priya Raman', role: 'Regular client', rating: 5 },
          { quote: 'I moved my appointment twice and never once had to phone anyone. Genuinely a relief.', author: 'Tom Whelan', role: 'Client since 2024', rating: 5 },
          { quote: 'Clear prices, clear times, no surprises when I arrived. That is rarer than it should be.', author: 'Elena Vasquez', role: 'First-time client', rating: 5 },
        ]}
      />

      <FAQSection
        items={[
          { title: 'How do I change or cancel a booking?', content: 'Sign in and open My Bookings. You can cancel any appointment up to 24 hours before it starts.' },
          { title: 'Do I pay when I book?', content: 'No — booking is free. You pay at the appointment itself unless a service says otherwise.' },
          { title: 'What if the time I want is not shown?', content: 'Any slot that is not shown is already taken. Try the next day, or check back — cancellations free up slots regularly.' },
          { title: 'Can I book for someone else?', content: 'Yes. Put their name in the booking and add anything we should know in the notes.' },
        ]}
      />

      <CTASection
        title="Ready when you are"
        subtitle="Find a time that works and lock it in."
        primaryCta={{ label: 'Book an appointment', to: '/book' }}
        secondaryCta={{ label: 'Browse services', to: '/services' }}
        tone="brand"
      />
    </>
  )
}
