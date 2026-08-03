<!--
  The layout taxonomy — owner-authored, 2026-08-01.

  This is the SOURCE document for builder/site-layouts.mjs: every numbered
  family below has an entry in the module's FAMILIES table, every bullet under
  "structural variants" has an entry in STRUCTURES, and test/site-layouts.test.mjs
  holds the two in bijection. Edit here, then mirror there — the test fails on
  any drift, in either direction.

  A LAYOUT IS NOT A THEME. Themes vary how a site looks (site-theme.mjs);
  layouts vary how it is ARRANGED — the hero pattern, the body rhythm, and
  which verb leads. The reference pages stay one constant set (the grammar all
  families share); the chosen family rides in the per-build USER message, so
  the cached system block never varies.
-->

# Website Layout Families

A taxonomy of site *kinds* grouped by the layout family they belong to.
Each family shares a hero pattern, a body rhythm, and a primary CTA.

---

## 1. Salon, barber or clinic — booking-first
**Shape:** calendar / slot picker is the hero. Everything else supports the appointment.
**CTA:** Book now · Check availability

- Salon, spa, nail studio
- Clinic, dental, therapy
- Tattoo studio
- Home services (plumber, electrician, HVAC)
- Fitness studio / yoga

---

## 2. Estate agent, dealer or any big listing — search-first
**Shape:** filter rail + result grid. Search bar sits above or replaces the hero.
**CTA:** View listing · Save · Inquire

- Real estate
- Car dealership
- Job board
- Rentals (equipment, venues, gear)
- Travel + hotel

---

## 3. Agency, studio or practice — the work as evidence
**Shape:** the work speaks. Large imagery, minimal copy, contact is the destination.
**CTA:** Start a project · Inquire

- Agency / consultancy — case studies
- Law firm — practice areas + consult
- Architecture / interior
- Photographer, videographer
- Wedding & event vendors (gallery → inquiry)

---

## 4. Podcast, blog or newsletter — the feed is the page
**Shape:** reverse-chronological stream. Newest thing on top, nav is secondary.
**CTA:** Read · Subscribe

- Publication, blog, magazine
- Podcast (episode list + player)
- Newsletter
- Creator / personal brand

---

## 5. Software product — product-first
**Shape:** the thing itself is the hero — screenshot, render, or trailer.
**CTA:** Sign up · Buy · Download

- SaaS — signup + feature proof
- Mobile app — screenshot carousel + store badges
- Hardware — hero shot + specs + buy
- Game — trailer video takeover
- Developer tool / API

---

## 6. One page, one ask — a fundraiser, launch or event
**Shape:** one page, one action. Everything is subordinate to a single button.
**CTA:** Donate · Register · Enroll · Join

- Nonprofit → cause + donate
- Event / conference → date, lineup, tickets
- Course / cohort → outcome + curriculum + enroll
- Community / membership → join + social proof
- Coming soon → one field, nothing else

---

## 7. Accountant, solicitor or adviser — trust-first
**Shape:** credentials, licensing, and proof before any pitch. Conservative typography.
**CTA:** Free consultation · Get a quote

- Accounting, tax prep, bookkeeping
- Insurance broker
- Financial advisor / wealth management
- Medical specialist practice
- Childcare, eldercare, tutoring
- Veterinary — *booking hybrid*

---

## 8. Restaurant or café — menu-first
**Shape:** the list of things IS the page. Often single-scroll, sometimes no nav at all.
**CTA:** Order · Reserve · Directions

- Café, deli, food truck
- Bakery / catering
- Bar / brewery
- Delivery-native (ghost kitchen) — order widget above everything

---

## 9. Gym or any multi-branch business — location-first
**Shape:** map is load-bearing. Locator or property switcher near the top.
**CTA:** Find nearest · Get directions

- Multi-location franchise → store locator
- Gym chain, coworking spaces
- Dispensary, pharmacy
- Hotel group / resort
- Retail with pickup — *in-stock near you*

---

## 10. One person's name as the brand — narrative-first
**Shape:** one person is the product. Portrait, story, then proof of authority.
**CTA:** Book me · Apply · Follow

- Résumé site
- Speaker / author — bio, talks, book, booking
- Coach / consultant — problem → method → apply
- Politician / campaign — *donate + volunteer split*
- Artist / musician — tour dates + release

---

## 11. Developer documentation — reference-first
**Shape:** persistent sidebar, dense internal linking, search always visible.
**CTA:** Copy install command · Get started

- API reference, SDK docs
- Open source project — install command as hero
- Knowledge base / help center — search bar + categories
- Changelog / status page — reverse-chronological, no marketing

---

## 12. Research, figures or a comparison — data-first
**Shape:** numbers or the interface showing numbers is the hero.
**CTA:** Try it · Download report · Compare

- Dashboard product — screenshot of the dashboard *is* the hero
- Analytics / BI tool
- Pricing calculator as landing page
- Comparison / review site — table above the fold
- Research report / whitepaper — gated download

---

## 13. College, council or hospital — a task register
**Shape:** audience-split navigation. Multiple unrelated user journeys share one homepage.
**CTA:** Apply · Find · Pay · Visit

- University / school — audience-split nav (prospective, current, alumni)
- Government / municipal — task-oriented, search-heavy
- Hospital system — find a doctor + find a location + pay bill
- Museum / gallery — hours, exhibitions, tickets
- Church / congregation — service times + livestream

---

## 14. Hotel, retreat or destination — media-heavy
**Shape:** full-bleed imagery or video, minimal chrome, sparse type, scroll as choreography.
**CTA:** Explore · Configure · Shop

- Fashion brand — full-bleed editorial, minimal chrome
- Car manufacturer — configurator
- Luxury hospitality — video loop, sparse type
- Film / show — trailer takeover
- Awwwards-style studio — scroll-jacked narrative

---

## 15. A customer portal or utility — finish the task, leave
**Shape:** no marketing. Form, state, confirmation. Layout discipline over expression.
**CTA:** Submit · Continue · Pay

- SaaS billing / customer portal
- Support ticket submission
- Appointment reminder / confirmation page
- Checkout flow (its own layout discipline entirely)
- 404, maintenance, waitlist — micro-layouts worth designing on purpose

---

## 16. Licensed trade or regulated seller — disclosure-heavy
**Shape:** compliance blocks are structural, not footnotes. Gates and disclaimers shape the page.
**CTA:** Open account · Verify age · View rates

- Bank, credit union — rates table + login prominent
- Crypto exchange — chart hero + regulatory footer
- Pharma / drug brand — ISI block, safety info dominates layout
- Cannabis retail — age gate before anything renders
- Gambling / sportsbook — odds board as homepage

---

## 17. Box office, auction or drop — the clock is the content
**Shape:** live state is the content. Countdowns, auto-refresh, ends-in timers.
**CTA:** Bid · Buy now · Refresh

- Ticketing / box office — seat map, countdown
- Auction — live bid state, ends-in timer
- Flash sale / drop — countdown + waitlist
- Election night / live results — auto-refreshing data
- Weather, transit, outage — status-first, no marketing

---

## 18. Paid publication or private community — membership-gated
**Shape:** two different sites — logged-out is a pitch, logged-in is a product.
**CTA:** Subscribe · Log in · Join

- Paywalled publication — meter, partial article + wall
- Private community — logged-out pitch page, logged-in feed
- Alumni / association portal
- Fan club / Patreon-style — tier ladder
- B2B customer portal — auth wall is the front door

---

## 19. Manufacturer, wholesaler or trade supplier — spec-first
**Shape:** specs, downloads, and quote paths. Pricing often behind auth.
**CTA:** Request quote · Download spec · Find distributor

- Manufacturer — spec sheets, CAD downloads, distributor locator
- Logistics / freight — quote calculator, tracking input
- Construction / GC — project portfolio + bid submission
- Wholesale / distributor — login for pricing, catalog behind auth
- Lab / testing services — capability matrix

---

## 20. A careers site — roles-first
**Shape:** filtered role list plus culture proof. Sometimes dual-audience.
**CTA:** Apply · Submit résumé · Post a job

- Careers site — filters + culture + apply
- Staffing agency — dual audience (employers / job seekers)
- Talent marketplace — profile-as-page
- Internship / bootcamp — outcomes + placement stats

---

## 21. A course you sell — curriculum-first
**Shape:** curriculum tree or practice surface. Progress is a visible element.
**CTA:** Enroll · Start lesson · Practice

- Online course platform — path / curriculum tree
- Documentation-as-course (interactive tutorial)
- LMS student dashboard
- Flashcard / practice tool — the tool IS the homepage
- Library / archive — advanced search, faceted results

---

## 22. Library, community group or small charity — utility-first
**Shape:** hours, address, contact, documents. Utility over polish.
**CTA:** Visit · Contact · Download

- Restaurant chain locator
- HOA / neighborhood
- Library branch
- Nonprofit chapter site
- Small-town municipal — PDF-heavy

---

## 23. A wedding, party or personal occasion — one voice, one ask
**Shape:** intimate scale, one narrative, often single-page.
**CTA:** RSVP · Read · Give

- Wedding site — RSVP + registry + story
- Memorial / obituary
- Baby registry
- Résumé-as-single-page
- Personal wiki / digital garden — dense internal linking
- Link-in-bio — vertical stack, thumb-optimized

---

## 24. An AI tool — the prompt is the interface
**Shape:** the input is the hero. Try-before-signup, no auth wall, output is the proof.
**CTA:** Generate · Try it · Run

- Chat-as-homepage (input box is the entire hero)
- Agent / workflow builder — canvas UI
- Prompt gallery / model directory
- Playground — try-before-signup, no auth wall
- Generative tool — before/after slider hero

---

## 25. Store — cart-first
**Shape:** the products are the page and the basket is always in reach. Checkout is the destination.
**CTA:** Add to cart · Checkout

- Online store — general goods, the plain case
- Fashion boutique, jewellery, homeware, furniture
- Electronics, bookshop, gifts, pet supplies
- Single-product DTC brand
- Big catalogue

---

## 26. An internal tool — records-first, behind a sign-in
**Shape:** signed-in software rather than a website. A table of records, filters, one record opened fully.
**CTA:** Sign in · New record

- CRM, project management, applicant tracking
- Help desk
- Booking platform, inventory management, invoicing, HR portal
- Stage-driven work

---

## 27. Plumber, electrician or roofer — call-first
**Shape:** the phone number IS the hero and the proof is photographs of finished work.
**CTA:** Call now · Get a quote

- Plumber
- Electrician
- Roofer
- Builder
- Joiner
- Plasterer
- Heating engineer
- Locksmith
- Glazier
- Damp specialist

---

## 28. Charity or cause — donate-first
**Shape:** the ask is the page; everything else is evidence that the money works.
**CTA:** Donate · Give monthly

- Charity
- Foundation
- Food bank
- Hospice
- Animal rescue
- Community fund
- Appeal
- Trust
- Air ambulance
- Mutual aid

---

## 29. Church or place of worship — times-first
**Shape:** when we meet and what happens if you have never been, before anything else.
**CTA:** Plan a visit · Service times

- Church
- Chapel
- Mosque
- Synagogue
- Temple
- Meeting house
- Parish
- Congregation
- Cathedral
- Quaker meeting

---

## 30. Sports club — fixtures-first
**Shape:** the next fixture and the last result are the news; everything else is the club.
**CTA:** Join the club · Next fixture

- Football club
- Cricket club
- Rugby club
- Netball
- Athletics
- Running club
- Rowing
- Hockey
- Bowls
- Junior academy

---

## 31. Festival or multi-day event — lineup-first
**Shape:** the lineup grid is the product; tickets and travel are what it funnels into.
**CTA:** Buy tickets · See the lineup

- Music festival
- Food festival
- Literary festival
- Arts weekend
- County show
- Conference
- Comic con
- Pride
- Carnival
- Beer festival

---

## 32. A space for hire — capacity-first
**Shape:** how many it holds, what it costs and whether the date is free.
**CTA:** Check a date · Request the pack

- Wedding venue
- Function room
- Village hall
- Studio hire
- Conference centre
- Gallery hire
- Photography studio
- Marquee
- Barn
- Theatre hire

---

## 33. One holiday let — availability-first
**Shape:** one property, one calendar; book direct and skip the platform's cut.
**CTA:** Check availability · Book direct

- Holiday cottage
- Cabin
- Shepherd's hut
- Apartment
- Lodge
- Glamping
- Narrowboat
- Annexe
- Beach house
- Bothy

---

## 34. Garage or MOT centre — vehicle-first
**Shape:** you type a registration and the site answers with your car and its prices.
**CTA:** Book an MOT · Get a price

- Garage
- MOT centre
- Tyre fitter
- Bodyshop
- Valeting
- Car servicing
- Exhaust centre
- Auto electrician
- Mobile mechanic
- Fleet servicing

---

## 35. Funeral director — two-paths
**Shape:** somebody needing help tonight and somebody planning ahead are different readers, answered separately and immediately.
**CTA:** Call us now · Plan ahead

- Funeral director
- Celebrant
- Crematorium
- Memorial mason
- Bereavement service
- Will writer
- Probate
- Estate clearance
- Florist (funeral)
- Green burial

---

## 36. Nursery or childcare — sessions-first
**Shape:** the sessions, the fees and whether there is a place, before anything about the setting.
**CTA:** Book a visit · Check availability

- Nursery
- Pre-school
- Childminder
- After-school club
- Holiday club
- Forest school
- Creche
- Playgroup
- Daycare
- Tutoring centre

---

## 37. Medical or veterinary practice — register-first
**Shape:** urgent instructions first, then how to register, then everything else.
**CTA:** Register · Book an appointment

- GP practice
- Dental practice
- Veterinary surgery
- Physiotherapy
- Optician
- Podiatry
- Chiropractor
- Audiology
- Private clinic
- Osteopath

---

## 38. Gallery or museum — exhibition-first
**Shape:** what is on right now, at the size the work deserves.
**CTA:** Plan your visit · What's on

- Art gallery
- Museum
- Heritage site
- Artist studio
- Sculpture park
- Archive
- Craft centre
- Historic house
- Exhibition space
- Open studios

---

## 39. Brewery, winery or distillery — range-first
**Shape:** the drinks with their strength and style, then the room you can drink them in.
**CTA:** See the range · Book a tour

- Brewery
- Winery
- Distillery
- Cidery
- Taproom
- Roastery
- Creamery
- Smokehouse
- Bakery (wholesale)
- Kombucha

---

## 40. Farm shop or box scheme — season-first
**Shape:** what is good this week, which changes every week and is the entire pitch.
**CTA:** Order a box · What's in season

- Farm shop
- Veg box
- CSA
- Farmers' market
- Smallholding
- Pick your own
- Dairy
- Orchard
- Fishmonger
- Butcher

---

## 41. Local paper or newsroom — lead-first
**Shape:** one lead story, then sections; a hierarchy of importance rather than a stream.
**CTA:** Read the story · Subscribe

- Local paper
- Newsroom
- Magazine
- Trade publication
- Student paper
- Community news
- Investigative outlet
- Sports desk
- Listings weekly
- Parish magazine

---

## 42. Cleaning or grounds service — recurring-first
**Shape:** priced per visit and sold as a standing slot, not a one-off job.
**CTA:** Get a price · Book a first clean

- Domestic cleaning
- Commercial cleaning
- Window cleaner
- Gardener
- Grounds maintenance
- Oven cleaning
- Carpet cleaning
- Gutter clearing
- Pest control
- Pool maintenance

---

## 43. Removals or man-and-van — quote-first
**Shape:** the quote is a calculator, and the survey booking is what it converts into.
**CTA:** Get a quote · Book a survey

- Removals
- Man and van
- House clearance
- Office move
- Piano moving
- Storage and removals
- Packing service
- International move
- Student move
- Courier

---

## 44. Self-storage or unit hire — size-first
**Shape:** which size you need and whether one is free, answered with prices on the page.
**CTA:** Reserve a unit · See sizes

- Self storage
- Container storage
- Lock-up
- Workshop unit
- Studio hire
- Allotment plot
- Parking space
- Locker hire
- Archive storage
- Garage rental

---

## 45. Tutor or coach — subject-first
**Shape:** what you teach, to what level, at what rate — the three questions in that order.
**CTA:** Book a trial · See rates

- Private tutor
- Music teacher
- Driving instructor
- Language coach
- Exam prep
- Business coach
- Personal trainer
- Swim teacher
- Dog trainer
- Careers coach

---

## 46. Repair shop — device-first
**Shape:** pick the thing that is broken and the site answers with a price and a turnaround.
**CTA:** Get a price · Track a repair

- Phone repair
- Computer repair
- Watch repair
- Shoe repair
- Bike shop
- Instrument repair
- Jewellery repair
- Upholstery
- Clock repair
- Tailoring alterations

---

## 47. Two-sided marketplace — audience-first
**Shape:** supply and demand share one page; the toggle above the fold decides which you see.
**CTA:** Join · List · Find

- Marketplace
- Craft marketplace
- Resale site
- Rental marketplace
- Services marketplace
- Trade platform
- Ticket exchange
- Swap site
- Local classifieds
- Artisan collective

---

## 48. Directory — search-first
**Shape:** the search bar is the entire homepage; nothing appears until somebody asks for it.
**CTA:** Search · Browse

- Directory
- Business directory
- Trade directory
- Venue finder
- Club finder
- What's on listing
- Supplier index
- Member register
- Service finder
- Local guide

---

## 49. Hire by the day — item-and-dates-first
**Shape:** pick the thing, pick the dates, see the price — and the deposit is on the page, not in the small print.
**CTA:** Check availability · Reserve

- Van hire
- Car hire
- Tool hire
- Plant hire
- Marquee hire
- Party hire
- Skip hire
- Trailer hire
- Equipment hire
- AV hire

---

## 50. Taxi or private hire — fare-first
**Shape:** where from, where to, and a fixed price before anybody rings.
**CTA:** Get a fare · Book now

- Taxi
- Private hire
- Minicab
- Chauffeur
- Airport transfer
- Coach hire
- Minibus hire
- Executive travel
- Wheelchair accessible taxi
- Same-day courier

---

## 51. Care home — the place, the fees and the visit
**Shape:** what it is actually like, what it actually costs, and how to come and see it.
**CTA:** Arrange a visit · See the fees

- Care home
- Nursing home
- Residential care
- Dementia care
- Supported living
- Respite care
- Retirement village
- Extra care housing
- Hospice
- Learning disability care

---

## 52. Home care — visits-and-rates-first
**Shape:** what a visit actually is, what an hour costs, and who would be coming.
**CTA:** Arrange an assessment · See the rates

- Home care
- Domiciliary care
- Live-in care
- Companionship
- Respite at home
- Personal care
- Dementia care at home
- End of life care
- Reablement
- Night care

---

## 53. Pay-and-play facility — slot-first
**Shape:** book a slot or turn up, and the price depends on when rather than on who you are.
**CTA:** Book a slot · See what's free

- Golf club
- Bowling alley
- Climbing wall
- Swimming pool
- Leisure centre
- Snooker club
- Ice rink
- Tennis courts
- Padel club
- Driving range

---

## 54. Visitor attraction — plan-your-day-first
**Shape:** what it costs, when it opens, what happens at what time, and how long to allow.
**CTA:** Plan your visit · Book tickets

- Zoo
- Farm park
- Steam railway
- Castle
- Theme park
- Aquarium
- Stately home
- Wildlife park
- Adventure park
- Show cave

---

## 55. Kennels or cattery — dates-and-requirements-first
**Shape:** the dates, the nightly rate by size, and the vaccinations that must be done weeks in advance.
**CTA:** Check dates · Book a stay

- Kennels
- Cattery
- Dog daycare
- Home boarding
- Pet sitting
- Dog walking
- Small animal boarding
- Rabbit boarding
- Reptile boarding
- Aviary boarding

---

## 56. An act for hire — see-it-then-check-the-date
**Shape:** watch thirty seconds of it, then find out whether the date is free — in that order.
**CTA:** Check my date · Watch

- DJ
- Wedding band
- Function band
- Magician
- Children's entertainer
- Tribute act
- Caricaturist
- Close-up magic
- Casino hire
- Photo booth

---

## 57. Campsite or caravan park — will-it-fit-first
**Shape:** which pitch takes what you are arriving in, whether it has hookup, and when the gate is locked.
**CTA:** Check the pitches · Book a pitch

- Campsite
- Caravan park
- Touring site
- Glamping site
- Motorhome stopover
- Certificated location
- Camping field
- Aire
- Holiday park
- Residential park

---

## 58. B&B or guest house — book-direct-first
**Shape:** the rooms, what a single person actually pays, and what booking here saves against the platform.
**CTA:** Book direct · See the rooms

- Bed and breakfast
- Guest house
- Inn with rooms
- Farmhouse B&B
- Pub with rooms
- Boutique guesthouse
- Homestay
- Airbnb host
- Serviced room
- Hostel

---

## 59. A shop that does not sell online — counter-first
**Shape:** what you can actually do at the counter, and the hours for each, which are not the shop's hours.
**CTA:** What we do · Find us

- Corner shop
- Newsagent
- Post office
- Off licence
- Hardware shop
- Pharmacy
- Greengrocer
- Dry cleaner
- Convenience store
- Village shop
- Key cutting
- Parcel shop
- Launderette
- Tobacconist
- Sweet shop

---

## 60. Trade supplier — do-I-qualify-first
**Shape:** the minimum order, the carriage-paid line, the delivery days and whether an account is needed — before any product.
**CTA:** Open an account · See the terms

- Wholesaler
- Cash and carry
- Trade counter
- Trade supplier
- Importer
- Distributor
- Buying group
- Catering supplier
- Builders merchant
- Trade only

---

## 61. Selling a franchise — total-cost-first
**Shape:** what it really costs to open, what is NOT in that figure, and which territories are actually free.
**CTA:** What it costs · Which areas are free

- Franchise
- Franchise opportunity
- Master franchise
- Licensee scheme
- Dealership opportunity
- Management franchise
- Van franchise
- Area development
- Partner programme
- Business opportunity

---

## 62. Lettings agent — what-it-costs-to-move-in-first
**Shape:** the money a tenant actually needs up front, and the landlord fee as a percentage rather than "competitive".
**CTA:** What it costs to move in · Landlords

- Letting agent
- Student lettings
- HMO management
- Block management
- Build to rent
- Corporate lettings
- Holiday let management
- Guaranteed rent
- Rent to rent
- Relocation agent

---

## 63. Institute or association — which-grade-am-I-first
**Shape:** the membership ladder with what each grade REQUIRES, so somebody can place themselves in ten seconds.
**CTA:** Which grade am I? · Find a member

- Professional body
- Institute
- Trade association
- Chartered body
- Licensing board
- Accreditation scheme
- Regulator
- Membership organisation
- Guild
- Learned society

---

## 64. Parish or town council — next-meeting-first
**Shape:** when the next meeting is, whether the agenda is out yet, and what the precept costs on your band.
**CTA:** Next meeting · Papers

- Parish council
- Town council
- Community council
- Residents association
- Neighbourhood forum
- School governors
- Allotment association
- Village hall committee
- Civic society
- Friends group

---

## 65. Livery yard or riding school — is-there-a-space-first
**Shape:** the livery packages by the week, what turnout actually means here, and whether a stable is free.
**CTA:** Is there a space? · Book a lesson

- Livery yard
- Riding school
- Equestrian centre
- Stud
- Pony club centre
- Trekking centre
- Horse transport
- Farrier
- Equine therapy
- Carriage driving

---

## 66. Broadband or network provider — can-I-get-it-first
**Shape:** the address checker is the hero; every package below it is conditional on the answer.
**CTA:** Check my address · See packages

- Broadband
- ISP
- Full fibre
- Network operator
- Mobile network
- Satellite internet
- Altnet
- Business connectivity

---

## 67. Energy or metered supplier — tariff-first
**Shape:** the tariffs side by side with the standing charge shown, then how to read and send a meter.
**CTA:** Compare tariffs · Send a reading

- Energy supplier
- Gas
- Electricity
- Water
- Heat network
- Metered service
- Community energy

---

## 68. Bank, lender or credit union — rates-first
**Shape:** every rate with its conditions in the same row, who may join, and what repayment looks like.
**CTA:** Apply to join · See rates

- Credit union
- Building society
- Community lender
- Savings provider
- Mutual
- Friendly society

---

## 69. Insurance or protection — cover-levels-first
**Shape:** levels as parallel columns with the exclusions and the excess beside the cover they apply to.
**CTA:** Get a quote · Compare cover

- Insurance
- Protection
- Warranty
- Pet insurance
- Travel insurance
- Insurance broker
- Breakdown cover
- Home emergency

---

## 70. Free advice service — urgent-help-first
**Shape:** how to reach a person today, then which debts to deal with first and why.
**CTA:** Talk to an adviser · Start with the checklist

- Debt advice
- Money advice
- Welfare rights
- Law centre
- Citizens advice
- Advice service
- Hardship fund

---

## 71. A subscription — plan-and-frequency-first
**Shape:** size and frequency chosen together before payment, with pause and cancel beside them.
**CTA:** Start a box · See the plans

- Subscription box
- Coffee subscription
- Wine club
- Book club
- Pet box
- Razor subscription
- Flower subscription

---

## 72. Meal plan or recipe box — this-week's-menu-first
**Shape:** this week's dishes and the cut-off lead; the plan is chosen after the food.
**CTA:** See this week · Choose a plan

- Recipe box
- Meal plan
- Meal prep
- Veg box
- Food subscription
- Diet plan
- Prepared meals

---

## 73. Street food or mobile trader — where-today-first
**Shape:** today's pitch and hours above everything, then the week, then hiring the van.
**CTA:** Where we are today · Book us

- Food truck
- Street food
- Mobile catering
- Market stall
- Coffee van
- Mobile trader
- Pop-up kitchen
- Ice cream van

---

## 74. Coach or minibus hire — route-and-date-first
**Shape:** seats, date and route set the price; the fleet is listed by capacity, not prettiness.
**CTA:** Get a quote · Check a date

- Coach hire
- Minibus hire
- School transport
- Airport transfer
- Wedding transport
- Private hire
- Day trips

---

## 75. Caterer or event supplier — headcount-first
**Shape:** a headcount and a date drive every figure, and the minimum spend is in the hero.
**CTA:** Get a quote · See the menus

- Caterer
- Event catering
- Wedding catering
- Buffet
- Hog roast
- Corporate catering
- Canapes
- Grazing table

---

## 76. Driving school or instructor — pass-rate-first
**Shape:** the pass rate with its sample size, how far out the diary is, and the test-centre wait.
**CTA:** Book a first lesson · Check availability

- Driving school
- Driving instructor
- Intensive course
- Motorcycle training
- HGV training
- Pass Plus
- Refresher lessons

---

## 77. Music or arts school — instrument-and-grade-first
**Shape:** the instruments as the rail; the timetable and the termly fee follow from instrument and stage.
**CTA:** Book a taster · See the timetable

- Music school
- Music teacher
- Drama school
- Dance school
- Art class
- Stage school
- Peripatetic teaching

---

## 78. Primary or secondary school — parents-first
**Shape:** term dates, absence and the newsletter first; closure days sit inside each term.
**CTA:** Report an absence · Term dates

- Primary school
- Secondary school
- Academy
- Sixth form
- Special school
- Independent school
- Nursery school
- Pupil referral unit

---

## 79. Training provider — am-I-eligible-first
**Shape:** eligibility leads; every course card names its entry requirements and who pays.
**CTA:** Check eligibility · Apply

- Training provider
- Apprenticeship
- Adult education
- Skills bootcamp
- Further education
- Vocational training
- Employability programme

---

## 80. Housing association or social landlord — report-a-repair-first
**Shape:** a grid of the four tenant doors, repairs first, with response times and complaints in writing.
**CTA:** Report a repair · Pay rent

- Housing association
- Social landlord
- Council housing
- Almshouse
- Tenant management
- Co-operative housing
- Supported housing

---

## 81. Optician or hearing centre — test-then-frames
**Shape:** an appointment on one side and a shop on the other, with the NHS entitlement stated.
**CTA:** Book an eye test · Browse frames

- Optician
- Optometrist
- Hearing centre
- Audiologist
- Eyewear
- Contact lenses
- Dispensing optician

---

## 82. Pharmacy or dispensary — prescriptions-and-services-first
**Shape:** repeats and no-appointment services as a grid, with when the pharmacist is actually in.
**CTA:** Order a repeat · See services

- Pharmacy
- Chemist
- Dispensary
- Travel clinic
- Vaccination service
- Community pharmacy

---

## 83. Bike or equipment shop — buy-and-service
**Shape:** what is in stock in which sizes, and how many weeks out the workshop is.
**CTA:** Book a service · See what is in

- Bike shop
- Cycle shop
- Ski hire
- Outdoor shop
- Golf shop
- Music shop
- Camera shop
- Equipment retailer

---

## 84. Garden centre or plant nursery — what's-good-now-first
**Shape:** this month's planting as advice, then what of it is in stock, then the visit facts.
**CTA:** What's in now · Plan a visit

- Garden centre
- Plant nursery
- Seed merchant
- Florist
- Landscaping supplier
- Allotment shop
- Farm nursery

---

## 85. Antiques or one-of-a-kind dealer — each-piece-unique
**Shape:** each piece its own measure, provenance and condition given room, sold pieces kept and marked.
**CTA:** Enquire · See the stock

- Antiques
- Art dealer
- Vintage
- Rare books
- Coins and medals
- Classic cars
- Salvage
- Auction consignment

---

## 86. Golf or members' club — membership-and-tee-times
**Shape:** joining, visiting, the next tee time and the dress code as four tiles; visitors answered first.
**CTA:** Book a tee time · Join

- Golf club
- Members club
- Bowls club
- Sailing club
- Shooting ground
- Tennis club
- Country club
- Angling club

---

## 87. Band or touring artist — tour-dates-first
**Shape:** the next date and the ticket link in the first screen; sold-out and cancelled dates stay listed.
**CTA:** Get tickets · Listen

- Band
- Musician
- Touring artist
- DJ
- Orchestra
- Comedian
- Theatre company
- Spoken word

---

## 88. A game — trailer-first
**Shape:** the trailer full width, then the platforms with confirmed and hoped-for distinguished.
**CTA:** Wishlist · Buy now

- Game
- Indie game
- Mobile app
- Software launch
- Hardware product
- Board game
- Kickstarter

---

## 89. A film or production — screenings-first
**Shape:** the trailer, then where it is actually showing, with Q&A dates marked and past runs kept.
**CTA:** Find a screening · Watch the trailer

- Film
- Documentary
- Short film
- Theatre production
- Festival premiere
- Screening tour
- Independent cinema

---

## 90. Solar or retrofit installer — savings-calculator-first
**Shape:** a calculator from roof size and current bill, producing a payback BAND rather than a figure.
**CTA:** Estimate my saving · Book a survey

- Solar installer
- Heat pump
- Battery storage
- EV charger
- Insulation
- Retrofit
- Renewable energy

---

## 91. Skip hire or waste collection — size-and-date-first
**Shape:** sizes against something you can picture, the next date, and the permit question.
**CTA:** Book a skip · Check permits

- Skip hire
- Waste collection
- House clearance
- Grab hire
- Man and van waste
- Recycling
- Scrap metal

---

## 92. Alarm, CCTV or guarding — response-first
**Shape:** the contractual response time with last quarter's actual beside it, then the systems.
**CTA:** Book a survey · Talk to us

- Alarm installer
- CCTV
- Security guarding
- Keyholding
- Access control
- Monitoring centre
- Mobile patrol

---

## 93. Memorial mason — regulations-and-choosing
**Shape:** the burial authority's rules first, quietly, then the choosing and the honest timescale.
**CTA:** Talk to us · See memorials

- Memorial mason
- Monumental mason
- Headstones
- Cremation memorials
- Renovation and re-lettering
- Cemetery works

---

## 94. Translation or interpreting — language-pair-first
**Shape:** monospace, no imagery — the pairs, the per-word rate and the turnaround.
**CTA:** Get a quote · Send a document

- Translation
- Interpreting
- Transcription
- Subtitling
- Localisation
- Certified translation
- Sign language

---

## 95. Scheduled transport — departures-first
**Shape:** a departure board at the top with expected times rather than "delayed"; cancellations stay listed.
**CTA:** Next departures · Full timetable

- Bus service
- Community transport
- Ferry
- Park and ride
- Shuttle
- Dial-a-ride
- Heritage railway

---

## 96. Escape room or timed activity — pick-a-slot-first
**Shape:** rooms as cards with difficulty, group size and escape rate, then tonight's free times.
**CTA:** Book a slot · See the rooms

- Escape room
- Axe throwing
- Crazy golf
- Laser tag
- Immersive experience
- Bowling
- Climbing wall
- VR arcade

---

## 97. Outdoor activity centre — conditions-and-tickets-first
**Shape:** what is running today above everything; each activity states its real age and weight limits.
**CTA:** Book a session · Today's conditions

- Activity centre
- Outdoor pursuits
- Water sports
- Climbing centre
- High ropes
- Kayaking
- Coasteering
- Forest school

---

## 98. Allotment or community land — plot-availability-first
**Shape:** the wait in months with how many are ahead, the rent, and what the tenancy demands.
**CTA:** Join the waiting list · See the rules

- Allotment association
- Community garden
- Orchard group
- Community farm
- Growing project
- Meanwhile space

---

## 99. Print or sign shop — spec-and-quantity-first
**Shape:** a product rail, the quantity price breaks as a real table, then the artwork requirements.
**CTA:** Get a price · Send artwork

- Printers
- Sign shop
- Copy shop
- Vehicle graphics
- Banner printing
- Wide format
- Embroidery
- Screen printing

---

## 100. Currency or bullion dealer — live-rates-first
**Shape:** a rate board with the time it was set, buy and sell together so the spread is visible.
**CTA:** Today's rates · Reserve currency

- Bureau de change
- Currency exchange
- Bullion dealer
- Coin dealer
- Money transfer
- Travel money

---

## Cross-cutting: structural variants

Any family above can be expressed through:

- Single-page scroll
- Bento grid
- Sidebar-persistent
- Split-screen 50/50
- Full-bleed hero + centered content column
- Card-grid dense
- Editorial asymmetric
- Terminal / monospace minimal
