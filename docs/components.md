# The component kit

**500 components**, in `builder/lovable/template/src/components/ui/`. Every one is
available to a generated site; the page generator is given this list of names in
`PAGE_RULES`, and the exact props of whatever a page imported on a repair.

The 61 shadcn/ui primitives are listed first and have no description here —
they are documented at ui.shadcn.com and take standard HTML props. The
439 after them were written for this platform, and are described
below. `className` is omitted from every props column: all 500 take it.

**This file is generated** by `builder/gen-components-doc.mjs` from the
components themselves — their doc comments and their signatures. Do not edit it
by hand; run the script. `test/components-doc.test.mjs` regenerates and fails
on any difference, so it cannot drift from the kit.

## shadcn/ui

| component | what it is for | props |
|---|---|---|
| `accordion` | — | — |
| `alert-dialog` | — | — |
| `alert` | — | — |
| `aspect-ratio` | — | — |
| `avatar` | — | — |
| `badge` | — | — |
| `breadcrumb` | — | — |
| `button` | — | — |
| `calendar` | — | — |
| `card` | — | — |
| `carousel` | — | — |
| `chart` | — | — |
| `checkbox` | — | — |
| `collapsible` | — | — |
| `command` | — | — |
| `context-menu` | — | — |
| `dialog` | — | — |
| `drawer` | — | — |
| `dropdown-menu` | — | — |
| `form` | — | — |
| `hover-card` | — | — |
| `input-otp` | — | — |
| `input` | — | — |
| `label` | — | — |
| `menubar` | — | — |
| `navigation-menu` | — | — |
| `pagination` | — | — |
| `popover` | — | — |
| `progress` | — | — |
| `radio-group` | — | — |
| `resizable` | — | — |
| `scroll-area` | — | — |
| `select` | — | — |
| `separator` | — | — |
| `sheet` | — | — |
| `sidebar` | — | — |
| `skeleton` | — | — |
| `slider` | — | — |
| `sonner` | — | — |
| `switch` | — | — |
| `table` | — | — |
| `tabs` | — | — |
| `textarea` | — | — |
| `toggle-group` | — | — |
| `toggle` | — | — |
| `tooltip` | — | — |
| `empty` | — | — |
| `spinner` | — | — |
| `field` | — | — |
| `input-group` | — | — |
| `button-group` | — | — |
| `item` | — | — |
| `kbd` | — | — |
| `native-select` | — | — |
| `combobox` | — | — |
| `direction` | — | — |
| `attachment` | — | — |
| `bubble` | — | — |
| `marker` | — | — |
| `message` | — | — |
| `message-scroller` | — | — |

## OURS, not shadcn's (2026-07-30)

### Page sections

| component | what it is for | props |
|---|---|---|
| `hero` | The top of a home page: headline, one line of copy, and up to two actions. | `title: string, subtitle?: string, primary?: HeroAction, secondary?: HeroAction, image?: string \| null, align?: "left" \| "center" = "left"` |
| `hero-split` | Copy on one side, picture on the other. The other half of the hero decision. | `title: string, subtitle?: string, action?: object, image?: string \| null, imageAlt?: string, reverse?: boolean` |
| `section-header` | Eyebrow + title + description. The top of nearly every section on a site. | `eyebrow?: string, title: string, description?: string, align?: "left" \| "center" = "left"` |
| `feature-grid` | Two to four things the business wants to say about itself. | `items: Feature[], columns?: 2 \| 3 \| 4 = 3` |
| `stats-band` | A row of big numbers. Tabular figures so they line up under each other. | `items: Stat[]` |
| `pricing-table` | Tiered pricing. One tier may be `featured`, which is the only visual emphasis. | `tiers: Tier[]` |
| `price-list` | Name, description, price — a menu or a service list. | `items: PriceRow[], currency?: string = "£", action?: object` |
| `menu-section` | A menu in categories — Starters, Mains, Drinks. | `groups: MenuGroup[], currency?: string = "£"` |
| `testimonial` | One customer saying something. | `item: Quote · items: Quote[]` |
| `cta-band` | The closing ask, at the bottom of a page. | `title: string, description?: string, action?: object` |
| `faq` | Questions and answers, on the accordion. | `items: QA[]` |
| `steps` | How it works, numbered. | `items: Step[]` |
| `team-grid` | The people. Photos are owner-supplied and therefore guarded. | `items: Member[]` |
| `gallery` | A grid of pictures, each opening full size. | `items: Shot[], columns?: 2 \| 3 \| 4 = 3` |
| `logo-cloud` | "As featured in" — names or logos, kept quiet on purpose. | `items: { name: string; logo?: string \| null }[], label?: string` |
| `announcement-bar` | A strip across the top. Dismissible, because an undismissable one is an ad. | `children: React.ReactNode, href?: string, dismissible?: boolean = true` |
| `site-header` | The site's top bar, with a real mobile menu rather than links that vanish. | `brand: string, links?: NavLink[] = [], action?: object` |
| `site-footer` | The bottom of every page: a line about the business, some links, the year. | `brand: string, tagline?: string, links?: { label: string; href: string }[] = []` |
| `before-after` | Two pictures, one wipe between them. | `before?: string \| null, after?: string \| null, beforeLabel?: string = "Before", afterLabel?: string = "After", ratio?: string = "4/3"` |

### The business itself

| component | what it is for | props |
|---|---|---|
| `opening-hours` | 0 = Sunday, matching Date.getDay(). | `days: DayHours[], now?: Date` |
| `contact-card` | Address, phone, email — each a real link. | `address?: string \| null, phone?: string \| null, email?: string \| null, mapUrl?: string` |
| `location-card` | Where the business is, and a button that opens directions. | `name?: string, address: string, note?: string` |
| `availability-grid` | Which times are still free. | `slots: string[], taken?: string[] = [], value?: string \| null, onSelect?: (slot: string) => void` |
| `review-stars` | A rating out of five. Announced to screen readers as a sentence, not as icons. | `value: number, count?: number, max?: number = 5` |
| `social-links` | Icon links out. An unknown network gets the globe rather than disappearing. | `links: { network: string; href: string }[]` |

### Data and state

| component | what it is for | props |
|---|---|---|
| `data-list` | The four states of a list, once. | `query: object, children: (row: T, index: number) => React.ReactNode, empty?: { title: string; description?: string }, error?: string, skeleton?: number = 3, skeletonClassName?: string` |
| `stat-card` | One number with a label, and optionally how it has moved. | `label: string, value: string \| number, hint?: string, trend?: object` |
| `timeline` | Things in order, down the page. | `items: Moment[]` |
| `tag-list` | Badges in a row, optionally filterable. | `items: string[], active?: string \| null, onSelect?: (tag: string \| null) => void` |
| `countdown` | Time until something. Stops at zero rather than counting into the negative. | `to: string \| number \| Date, onDone?: () => void` |
| `marquee` | A strip that scrolls forever. | `items: React.ReactNode[], speed?: number = 30` |
| `safe-image` | An <img> that cannot render broken. | `src?: string \| null, alt?: string = "", ratio?: string = "4/3", fallback?: React.ReactNode` |
| `copy-button` | Copy a value, and say so. Falls back silently where the clipboard is blocked. | `value: string, label?: string = "Copy", iconOnly?: boolean` |
| `share-buttons` | Share this page. | `url?: string, title?: string` |

### Forms

| component | what it is for | props |
|---|---|---|
| `date-time-picker` | A date and a time, as two plain strings. | `date?: string, time?: string, onDateChange: (v: string) => void, onTimeChange: (v: string) => void, minDate?: Date, dateLabel?: string = "Date", timeLabel?: string = "Time"` |
| `phone-input` | A phone field that behaves like one on a phone. | `value: string, onChange: (v: string) => void, placeholder?: string = "07700 900123", id?: string` |
| `quantity-input` | A number with buttons. Clamped, so the value can never leave its range. | `value: number, onChange: (n: number) => void, min?: number = 1, max?: number = 99` |
| `file-drop` | Pick a picture, or drop one. | `onFile: (file: File) => void, accept?: string = "image/*", busy?: boolean, hint?: string = "PNG or JPEG, up to 2 MB"` |
| `success-panel` | What a visitor sees after submitting. | `title: string, description?: string, action?: object` |

## The second hundred (2026-07-30)

| component | what it is for | props |
|---|---|---|
| `container` | Page width and gutters, in one place. Every section on a site sits in one. | `size?: "sm" \| "md" \| "lg" \| "xl" \| "full" = "lg", children?: React.ReactNode` |
| `section` | Vertical rhythm. Sections that set their own padding drift apart down a page. | — |
| `stack` | A vertical flex with a gap. Layout does the spacing, not per-element margins. | `gap?: 1 \| 2 \| 3 \| 4 \| 6 \| 8 \| 10 = 4, align?: "start" \| "center" \| "end" \| "stretch", children?: React.ReactNode` |
| `inline` | The horizontal one. Wraps by default, because a row that overflows is a bug. | `gap?: 1 \| 2 \| 3 \| 4 \| 6 \| 8 = 2, align?: "start" \| "center" \| "end" \| "baseline" = "center", justify?: "start" \| "center" \| "end" \| "between", wrap?: boolean = true, children?: React.ReactNode` |
| `auto-grid` | A grid that reflows on its own. | `min?: number = 240, gap?: 2 \| 3 \| 4 \| 6 \| 8 = 4, children?: React.ReactNode` |
| `two-col` | Main and aside. Stacks on small screens with the aside underneath. | `aside: React.ReactNode, asideFirst?: boolean, ratio?: "1/1" \| "2/1" \| "3/1" = "2/1", gap?: 4 \| 6 \| 8 \| 10 = 8, children?: React.ReactNode` |
| `center-box` | Centres a panel in the viewport — sign-in, a 404, a confirmation. | `width?: "xs" \| "sm" \| "md" = "sm", children?: React.ReactNode` |
| `bento-grid` | Tiles of two sizes. A feature section that is not another row of equal cards. | `items: BentoItem[]` |
| `masonry` | Uneven heights, packed. | `columns?: 2 \| 3 \| 4 = 3, gap?: 2 \| 3 \| 4 \| 6 = 4, children?: React.ReactNode` |
| `sticky-bar` | A bar pinned to the bottom. On a phone this is where the real action goes. | `position?: "top" \| "bottom" = "bottom", children?: React.ReactNode` |
| `page-header` | Title, a line of context, and the actions for this page. | `title: string, description?: string, actions?: React.ReactNode, breadcrumb?: React.ReactNode` |
| `scroll-top` | Back to the top, once there is a top to go back to. | `after?: number = 600` |
| `divider-text` | A rule with a word in it — the "or" between a form and a provider button. | `children?: React.ReactNode = "or"` |
| `spacer` | Deliberate empty space, where a gap cannot reach. | `size?: 2 \| 4 \| 6 \| 8 \| 12 \| 16 \| 24 = 8` |
| `toolbar` | A row of controls above a list or a table. Left side, right side. | `start?: React.ReactNode, end?: React.ReactNode` |
| `overflow-scroller` | Content wider than the page, scrolling inside its own box. | `fade?: boolean = true, children?: React.ReactNode` |

### Typography

| component | what it is for | props |
|---|---|---|
| `prose` | A wrapper for rich text a site OWNS but did not write in JSX — an About page, a policy, a long description out of the database. Styles descendants, so the content needs no classes of its own. | `children?: React.ReactNode` |
| `heading` | A heading whose LEVEL and SIZE are separate props. | `level?: 1 \| 2 \| 3 \| 4 = 2, size?: "xs" \| "sm" \| "md" \| "lg" \| "xl", children?: React.ReactNode` |
| `text` | Body copy with the two decisions that actually recur: size and emphasis. | `size?: "xs" \| "sm" \| "md" \| "lg" = "md", tone?: "default" \| "muted" = "default", as?: "p" \| "span" \| "div", children?: React.ReactNode` |
| `lead` | The sentence under a title. Wider measure, lighter colour. | `children?: React.ReactNode` |
| `quote` | A pulled quote. Distinct from `testimonial`, which is a card with a person on it. | `cite?: string, children?: React.ReactNode` |
| `bullet-list` | A list with a real marker. Ticks for benefits, dots for everything else. | `items: React.ReactNode[], marker?: "dot" \| "check" = "dot", columns?: 1 \| 2 = 1` |
| `clamp-text` | Cut to a number of lines. For a description of unknown length inside a card. | `lines?: 1 \| 2 \| 3 \| 4 \| 5 \| 6 = 2, children?: React.ReactNode` |
| `expandable-text` | — | `lines?: 2 \| 3 \| 4 \| 5 = 3, more?: string = "Read more", less?: string = "Show less", children?: React.ReactNode` |

### Data display

| component | what it is for | props |
|---|---|---|
| `description-list` | Label and value pairs — a booking's details, an order summary, a spec. | `items: Pair[], layout?: "rows" \| "grid" = "rows"` |
| `key-value` | One pair, for dropping inline. Numbers get tabular figures so columns align. | `label: string, value: React.ReactNode, numeric?: boolean` |
| `data-table` | Defaults to reading `row[key]`. | — |
| `sortable-header` | A column header that sorts, and says which way it is sorting. | `label: React.ReactNode, direction?: "asc" \| "desc" \| null, onSort: () => void, numeric?: boolean` |
| `row-actions` | The … at the end of a row. | `actions: RowAction[], label?: string = "Actions"` |
| `avatar-group` | Overlapping faces with a +N. The count is announced, not just drawn. | `people: { name: string; initials?: string }[], max?: number = 4` |
| `status-dot` | A state, in one glyph. | `state?: "on" \| "pending" \| "off" \| "error" = "on", label?: string, showLabel?: boolean = true` |
| `status-badge` | A state as a chip. | `state?: "success" \| "warning" \| "danger" \| "neutral… = "neutral", children: React.ReactNode` |
| `progress-ring` | A circular percentage. Plain SVG — no chart library for one number. | `value: number, size?: number = 64, thickness?: number = 6, label?: string` |
| `metric-delta` | How a number has moved. | `value: string, direction: "up" \| "down" \| "flat", good?: boolean` |
| `count-badge` | A small number on a thing. Caps rather than growing the pill out of shape. | `count: number, max?: number = 99, label?: string` |
| `comparison-table` | Plans down the side, features down the middle. Booleans render as marks. | `columns: string[], rows: CompareRow[]` |
| `detail-panel` | One record, opened. Title, its fields, and whatever actions belong to it. | `title: string, items: Pair[], actions?: React.ReactNode` |
| `record-header` | The top of one record: what it is, its state, and what you can do to it. | `title: string, subtitle?: string, status?: React.ReactNode, actions?: React.ReactNode` |
| `legend` | What the marks mean. Shapes rather than colours, so it survives greyscale. | `items: { label: string; mark?: React.ReactNode }[]` |

### Feedback and state

| component | what it is for | props |
|---|---|---|
| `banner` | A page-level message. | `tone?: "info" \| "success" \| "warning" \| "error" = "info", title?: string, children?: React.ReactNode, icon?: React.ReactNode, action?: React.ReactNode, onDismiss?: () => void` |
| `callout` | An aside inside prose. A coloured rule down the left, not a filled box. | `tone?: "neutral" \| "success" \| "warning" \| "error" = "neutral", title?: string, icon?: React.ReactNode, children?: React.ReactNode` |
| `inline-alert` | One line under a field or a button. The smallest unit of "something happened". | `tone?: "muted" \| "success" \| "warning" \| "error" = "muted", children?: React.ReactNode` |
| `loading-overlay` | Covers its container while something is in flight. | `busy: boolean, label?: string = "Loading…", children?: React.ReactNode` |
| `stepper` | Progress through a multi-step flow. | `steps: string[], current: number` |
| `skeleton-text` | Placeholder lines. The last is short, because real paragraphs end mid-line. | `lines?: number = 3` |
| `skeleton-card` | A card-shaped placeholder, so a grid does not reflow when the data lands. | `media?: boolean = true` |
| `error-state` | Something did not load. | `title?: string = "That didn't load", description?: string, onRetry?: () => void` |
| `confirm-dialog` | "Are you sure?", with the consequence spelled out. | `trigger: React.ReactNode, title: string, description: string, confirmLabel?: string = "Confirm", cancelLabel?: string = "Cancel", destructive?: boolean, onConfirm: () => void` |
| `offline-banner` | Says the connection went, so a failed submit reads as the network rather than as the site being broken. Warning-toned: it is not an error the visitor caused, and it clears itself when they reconnect. | `message?: string = "You're offline. Some things won't work until you reconnect."` |
| `busy-button` | A button that cannot be pressed twice. | — |
| `retry-panel` | A compact inline retry, where a full error state would be too much. | `message?: string = "Couldn't load this.", onRetry: () => void` |

### Navigation

| component | what it is for | props |
|---|---|---|
| `tab-nav` | Tabs that are LINKS, not panels. | `items: object[], active?: string` |
| `nav-list` | A vertical list of links — a settings sidebar, a section index. | `items: object[], active?: string` |
| `anchor-nav` | A table of contents that follows the reader. | `items: { id: string; label: string }[]` |
| `back-link` | Up one level. Named, because "Back" alone tells nobody where they are going. | `href: string, label?: string = "Back"` |
| `prev-next` | Move between neighbouring records or articles. | `prev?: { label: string; href: string }, next?: { label: string; href: string }` |
| `link-card` | A whole card that is one link. | `title: string, description?: string, href: string, external?: boolean, icon?: React.ReactNode` |
| `mobile-nav` | The hamburger and its drawer, on its own so any header can use it. | `title?: string = "Menu", links: { label: string; href: string }[], action?: React.ReactNode` |
| `side-nav` | Grouped navigation down the side. Lighter than `sidebar`, which is an app shell. | `sections: NavSection[], active?: string` |
| `step-nav` | Back and Continue for a multi-step form. Continue carries the weight. | `onBack?: () => void, onNext?: () => void, backLabel?: string = "Back", nextLabel?: string = "Continue", nextDisabled?: boolean, busy?: boolean` |
| `nav-footer` | Columns of links, for a footer with more than a handful. | `columns: FooterColumn[]` |
| `result-count` | "Showing 1–20 of 84". Pluralised properly, and it says when a filter is narrowing the list — a visitor seeing three results needs to know why. | `from?: number, to?: number, total: number, noun?: string = "result", filtered?: boolean` |
| `external-link` | A link that leaves the site, and says so. | `href: string, showIcon?: boolean = true, children?: React.ReactNode` |

### Forms

| component | what it is for | props |
|---|---|---|
| `form-row` | Label, control, hint, error — the unit every form is made of. | `label: string, htmlFor?: string, hint?: string, error?: string, required?: boolean, children?: React.ReactNode` |
| `form-section` | A titled group of fields, for a form long enough to need dividing. | `title: string, description?: string, children?: React.ReactNode` |
| `form-actions` | Submit and cancel. Right-aligned, primary last — the order a form is read in. | `align?: "start" \| "end" \| "between" = "end", sticky?: boolean, children?: React.ReactNode` |
| `form-error-summary` | Every problem, listed at the top, each one a link to its field. | `errors: { field: string; message: string }[], title?: string = "Please fix the following"` |
| `field-hint` | The quiet line under a field. | `children?: React.ReactNode` |
| `required-mark` | The asterisk, announced properly rather than read out as punctuation. | — |
| `search-input` | Search, with a clear button. | `value: string, onChange: (v: string) => void, placeholder?: string = "Search…", id?: string` |
| `password-input` | A password field that can be read back. | `value: string, onChange: (v: string) => void, id?: string, autoComplete?: "current-password" \| "new-password" = "current-password", placeholder?: string` |
| `email-input` | An email field with the right keyboard and autofill hints. | `value: string, onChange: (v: string) => void, id?: string, placeholder?: string = "you@example.com"` |
| `url-input` | A web address. Adds https:// on blur when somebody typed a bare domain, which is what most people type and what most forms then reject. | `value: string, onChange: (v: string) => void, id?: string, placeholder?: string = "example.com"` |
| `number-input` | A number field. Clamped on change, so the value can never leave its range. | `value: number \| "", onChange: (n: number \| "") => void, min?: number, max?: number, step?: number = 1, id?: string` |
| `currency-input` | — | `value: string, onChange: (v: string) => void, symbol?: string = "£", id?: string, placeholder?: string = "0.00"` |
| `percent-input` | A percentage, kept between 0 and 100. | `value: string, onChange: (v: string) => void, id?: string` |
| `textarea-count` | A textarea that says how much room is left. | `value: string, onChange: (v: string) => void, max?: number = 500, id?: string, rows?: number = 4, placeholder?: string` |
| `checkbox-group` | Several checkboxes as one value. A real fieldset, so the group has a name. | `legend?: string, options: object[], value: string[], onChange: (next: string[]) => void, columns?: 1 \| 2 = 1` |
| `radio-cards` | Radios as pickable cards. | `options: object[], value?: string, onChange: (v: string) => void, columns?: 1 \| 2 \| 3 = 2` |
| `switch-row` | A setting: what it does on the left, the switch on the right. | `label: string, description?: string, checked: boolean, onChange: (v: boolean) => void, id?: string` |
| `multi-select` | Pick several. Built on `command` inside a `popover`, which is how shadcn does a searchable select — there is no multi-select primitive. | `options: { value: string; label: string }[], value: string[], onChange: (v: string[]) => void, placeholder?: string = "Select…"` |
| `address-fields` | A postal address. | `value: Address, onChange: (next: Address) => void` |
| `name-fields` | First and last name, or one field. | `single?: boolean = true, value: object, onChange: function` |

### Media

| component | what it is for | props |
|---|---|---|
| `video-embed` | A YouTube or Vimeo video, from whatever URL somebody pasted. | `url: string, title?: string = "Video", ratio?: string = "16/9"` |
| `audio-player` | A sound file. | `src: string, title?: string` |
| `cover-image` | A wide banner image with text over it, kept readable by a scrim. | `src?: string \| null, alt?: string, title?: string, subtitle?: string, ratio?: string = "21/9"` |
| `media-grid` | Pictures in a grid, with captions. `gallery` is the version that opens them. | `items: object[], columns?: 2 \| 3 \| 4 = 3, ratio?: string = "1/1"` |
| `image-strip` | A row of pictures that scrolls sideways. | `items: { src?: string \| null; alt?: string }[], size?: number = 200` |
| `avatar-upload` | Change a picture. | `src?: string \| null, name?: string = "", onFile: (f: File) => void, busy?: boolean` |
| `icon-badge` | An icon in a tile. The thing at the top of a feature card. | `size?: "sm" \| "md" \| "lg" = "md", variant?: "muted" \| "outline" \| "solid" = "muted", children?: React.ReactNode` |
| `logo` | A business's mark: its image if it has uploaded one, otherwise its initials. | `src?: string \| null, name: string, href?: string = "/", size?: "sm" \| "md" \| "lg" = "md"` |

### Utility

| component | what it is for | props |
|---|---|---|
| `theme-toggle` | Light and dark. | `storageKey?: string = "theme"` |
| `print-button` | Print this. For a booking confirmation or an invoice, which people do print. | `label?: string = "Print"` |
| `cookie-banner` | The consent strip. | `message?: string = "We use cookies to see which pages are read. Nothing is shared.", policyHref?: string, storageKey?: string = "cookie-consent", onDecision?: (accepted: boolean) => void` |
| `scroll-progress` | How far down a long page the reader is. Hidden from assistive tech — it is decoration. | — |
| `reveal` | Fades its children in as they arrive. | `delay?: number = 0, children?: React.ReactNode` |
| `time-ago` | "3 hours ago", in the visitor's own language. | `date: string \| number \| Date` |
| `duration` | Minutes as something readable: 90 becomes "1 hr 30 min". | `minutes: number` |
| `visually-hidden` | Text for screen readers only. | `children?: React.ReactNode` |
| `avatar-name` | A face and a name together — the row that appears in every list of people. | `name: string, subtitle?: string \| null, src?: string \| null, size?: "sm" \| "md" \| "lg" = "md", avatarOnly?: boolean` |

## The third hundred (2026-07-30)

| component | what it is for | props |
|---|---|---|
| `product-card` | One thing for sale. The whole card is the link; the button is a separate action. | `product: Product, currency?: string = "£", onAdd?: () => void, href?: string` |
| `price-tag` | A price, with a struck-through original when there is one. | `price: number \| string, was?: number \| string \| null, currency?: string = "£", size?: "sm" \| "md" \| "lg" = "md"` |
| `cart-line` | One row of a basket: picture, name, quantity, line total, remove. | `name: string, meta?: string \| null, image?: string \| null, price: number, quantity: number, currency?: string = "£", onQuantity?: (n: number) => void, onRemove?: () => void` |
| `cart-summary` | The basket panel: the figures plus the button that moves it forward. | `lines: SummaryLine[], total: number \| string, currency?: string = "£", action?: object, note?: string` |
| `order-summary` | Subtotal, delivery, discount, total. | `lines: SummaryLine[], total: number \| string, currency?: string = "£", note?: string` |
| `coupon-input` | A discount code. Uppercases as you type, because codes always are. | `onApply: (code: string) => void, applied?: string \| null, error?: string \| null, busy?: boolean` |
| `stock-badge` | How many are left. | `quantity: number, lowAt?: number = 5` |
| `variant-picker` | Size or colour options. | `name: string, label: string, options: object[], value?: string, onChange: (v: string) => void` |
| `delivery-estimate` | When it arrives. A date, not "3–5 working days", which nobody can count. | `from: string \| number \| Date, to?: string \| number \| Date, method?: string = "Standard delivery"` |
| `payment-methods` | Which cards are taken. | `methods?: string[] = ["Visa", "Mastercard", "Amex", "Apple Pay"], label?: string = "We accept"` |
| `trust-strip` | Three or four reassurances in a row — returns, delivery, support. | `items: object[]` |
| `order-tracker` | Where an order has got to. Horizontal on wide screens, vertical on a phone. | `stages: { label: string; at?: string }[], current: number` |
| `wishlist-button` | Save for later. `aria-pressed` carries the state, not the fill alone. | `saved?: boolean, onToggle: () => void, label?: string = "Save"` |
| `add-to-cart` | Quantity and the button together, disabled while the add is in flight. | `quantity: number, onQuantity: (n: number) => void, onAdd: () => void, busy?: boolean, soldOut?: boolean` |
| `calendar-month` | A month grid with things ON the days. | `month: Date, events?: Record<string, number> = {}, onSelect?: (iso: string) => void, selected?: string \| null` |
| `day-schedule` | One day, down the page. What an owner opens in the morning. | `date?: string, items: Appointment[], empty?: string = "Nothing booked", onSelect?: (a: Appointment) => void` |
| `week-strip` | Seven days as buttons. The date picker a booking page actually wants. | `start: Date, value?: string \| null, onSelect?: (iso: string) => void, disabled?: string[] = []` |
| `duration-picker` | How long, from a fixed set. Free-text minutes is a worse question to ask. | `options?: number[] = [15, 30, 45, 60, 90], value?: number \| null, onChange: (m: number) => void` |
| `party-size` | How many people. Buttons up to a point, then a "more" that means call us. | `max?: number = 8, value?: number \| null, onChange: (n: number) => void, onMore?: () => void` |
| `booking-summary` | What is about to be booked, shown before the button. | `items: Pair[], total?: number \| string, currency?: string = "£", footer?: React.ReactNode` |
| `cancel-policy` | The cancellation terms, before booking rather than after. | `hours?: number = 24, deposit?: string` |
| `waitlist-form` | Nothing free? Take the address anyway. A full day should not be a dead end. | `onSubmit: (email: string) => void, busy?: boolean, note?: string = "We'll email you if something frees up."` |
| `recurring-picker` | How often it repeats. A closed set, because "every 3rd Tuesday" is a rabbit hole. | `value?: string, onChange: (v: string) => void` |
| `timezone-note` | Which clock the times are in. | `siteZone: string` |

### Accounts and members

| component | what it is for | props |
|---|---|---|
| `login-form` | — | `onSubmit: function, busy?: boolean, error?: string \| null, forgotHref?: string, signupHref?: string` |
| `signup-form` | Create an account. `new-password` so a manager offers to generate one. | `onSubmit: function, busy?: boolean, error?: string \| null, terms?: React.ReactNode, loginHref?: string` |
| `reset-form` | Ask for a reset link. | `onSubmit: (email: string) => void, busy?: boolean, sent?: boolean, backHref?: string` |
| `otp-form` | The code from an email or a text. | `length?: number = 6, onSubmit: (code: string) => void, onResend?: () => void, busy?: boolean, error?: string \| null, sentTo?: string` |
| `profile-card` | Who is signed in, and what they can do about it. | `name: string, email?: string, avatar?: string \| null, meta?: React.ReactNode, actions?: React.ReactNode` |
| `account-menu` | The avatar in the corner. Sign out is separated, because it is the destructive one. | `name: string, email?: string, avatar?: string \| null, items?: object[] = [], onSignOut?: () => void` |
| `plan-card` | The plan somebody is on, and when it renews. | `name: string, price: string, period?: string, renewsOn?: string, current?: boolean, action?: object` |
| `usage-meter` | How much of an allowance is gone. | `label: string, used: number, total: number, unit?: string = "", warnAt?: number = 0.8` |
| `invite-form` | Invite somebody, with the role decided at the same time. | `roles?: string[] = ["Member", "Admin"], onSubmit: (v: { email: string; role: string }) => void, busy?: boolean` |
| `permission-row` | One person and what they may do. The owner's row cannot be changed. | `name: string, email?: string, avatar?: string \| null, role: string, roles?: string[] = ["Member", "Admin"], onRole?: (r: string) => void, locked?: boolean, actions?: React.ReactNode` |
| `danger-zone` | The irreversible actions, kept apart and behind a confirm. | `actions: object[], title?: string = "Danger zone"` |
| `session-row` | One signed-in device. | `device: string, where?: string \| null, lastSeen?: string \| number \| Date, current?: boolean, onRevoke?: () => void` |

### Dashboard and admin

| component | what it is for | props |
|---|---|---|
| `metric-row` | The row of numbers across the top of a dashboard. | `items: object[]` |
| `filter-bar` | The filters currently applied, each removable, with a clear-all. | `filters: { key: string; label: string }[], onRemove?: (key: string) => void, onClear?: () => void, children?: React.ReactNode` |
| `date-range-picker` | The date range every dashboard needs. | `value?: string, onChange: (v: string) => void, options?: { value: string; label: string }[]` |
| `bulk-actions` | The bar that appears when rows are selected. | `count: number, onClear?: () => void, actions: object[]` |
| `export-button` | Download this, in a format. | `formats?: string[] = ["CSV", "JSON"], onExport: (format: string) => void, busy?: boolean` |
| `column-toggle` | Which columns show. Real checkbox items, so the state is announced. | `columns: { key: string; label: string }[], visible: string[], onToggle: (key: string) => void` |
| `saved-views` | Named filter sets — "Today", "Unconfirmed". Counts where they are known. | `views: object[], active?: string, onSelect: (key: string) => void` |
| `activity-feed` | What happened recently, newest first. | `items: Activity[], empty?: string = "Nothing yet"` |
| `audit-row` | One line of a security log. | `action: string, who: string, at: string \| number \| Date, ok?: boolean = true, detail?: string \| null` |
| `inbox-list` | A list of messages or submissions. | `items: InboxItem[], selected?: string \| null, onSelect?: (id: string) => void, empty?: string = "Nothing here"` |
| `assignee-picker` | Who is handling this. "Unassigned" is a real option, not an empty state. | `people: { id: string; name: string }[], value?: string \| null, onChange: (id: string \| null) => void` |
| `priority-badge` | — | `level: "high" \| "medium" \| "low"` |

### Content and publishing

| component | what it is for | props |
|---|---|---|
| `article-card` | A post in a list. The image is guarded, because most posts do not have one. | `title: string, excerpt?: string \| null, image?: string \| null, href?: string, meta?: React.ReactNode` |
| `article-header` | The top of a post: title, standfirst, and who wrote it when. | `title: string, standfirst?: string, meta?: React.ReactNode` |
| `author-byline` | Who wrote it. | `name: string, role?: string \| null, avatar?: string \| null` |
| `reading-time` | How long it takes to read. | `words: number, wpm?: number = 200, showIcon?: boolean = true` |
| `post-meta` | Date, category and reading time on one line, with proper separators. | `date?: string \| number \| Date, category?: string \| null, readingTime?: React.ReactNode` |
| `related-list` | What to read next. Numbered, because a "top five" is a ranking. | `title?: string = "Read next", items: object[], ordered?: boolean` |
| `category-nav` | Filter by category. Scrolls sideways rather than wrapping into three rows. | `items: object[], active?: string \| null, onSelect: (key: string \| null) => void, allLabel?: string = "All"` |
| `figure` | A picture with a caption, as a real <figure>/<figcaption> pair. | `src?: string \| null, alt?: string, caption?: string, credit?: string, ratio?: string = "16/9"` |
| `code-block` | Code, with a copy button. | `code: string, language?: string` |
| `changelog-entry` | One release. The date is a real <time>, so it is machine-readable. | `version: string, date?: string \| number \| Date, tag?: "new" \| "fixed" \| "changed", children?: React.ReactNode` |
| `glossary-item` | A term and what it means, as a real definition pair. | `term: string, children?: React.ReactNode` |
| `faq-search` | Questions with a filter over them. | `items: QA[], placeholder?: string = "Search questions…"` |

### Social proof

| component | what it is for | props |
|---|---|---|
| `rating-summary` | The average plus the distribution. | `average: number, total: number, distribution: number[]` |
| `review-card` | One review. `verified` only where it is true — a badge on everything says nothing. | `name: string, rating: number, body: string, at?: string \| number \| Date, verified?: boolean, avatar?: string \| null` |
| `rating-input` | Give a rating. | `name?: string = "rating", value?: number, onChange: (n: number) => void, max?: number = 5` |
| `review-form` | Leave a review. The rating is required; the words are not. | `onSubmit: (v: { rating: number; body: string }) => void, busy?: boolean` |
| `verified-badge` | A verification mark, with the reason available rather than implied. | `label?: string = "Verified", title?: string` |
| `award-badge` | "Best of 2026" — an accolade with its year, so it cannot silently go stale. | `title: string, year?: string \| number, issuer?: string` |
| `press-quote` | What a publication said. Bigger than a testimonial, and attributed. | `quote: string, source: string, href?: string` |
| `case-study-card` | A customer story with the number that makes it a story. | `client: string, headline: string, result?: { value: string; label: string }, image?: string \| null, href?: string` |

### Interaction

| component | what it is for | props |
|---|---|---|
| `like-button` | A like with a count. `aria-pressed` carries the state, not the fill. | `count?: number = 0, liked?: boolean, onToggle: () => void` |
| `vote-buttons` | Up, down, and the score between. The score is announced as a score. | `score?: number = 0, vote?: 1 \| -1 \| null, onVote: (v: 1 \| -1 \| null) => void` |
| `emoji-reaction` | Reactions with counts. A pressed one is outlined as well as filled. | `reactions: object[], mine?: string[] = [], onToggle: (emoji: string) => void` |
| `nps-scale` | Zero to ten. Real radios, and the anchors are labelled at both ends. | `name?: string = "nps", value?: number, onChange: (n: number) => void, lowLabel?: string = "Not likely", highLabel?: string = "Very likely"` |
| `feedback-widget` | "Was this helpful?" | `question?: string = "Was this helpful?", onSubmit: function, busy?: boolean` |
| `labeled-progress` | A bar that says what it is and how far along. | `label: string, value: number, total?: number, unit?: string = ""` |
| `sticky-cta` | A booking bar that follows on a phone. | `label: string, price?: string, onClick?: () => void, href?: string, after?: number = 400` |
| `tour-step` | One step of a walkthrough, with its position and a way out. | `step: number, total: number, title: string, children?: React.ReactNode, onNext?: () => void, onSkip?: () => void` |
| `hotkey-list` | Keyboard shortcuts, as a real definition list. | `items: { keys: string[]; description: string }[]` |
| `toggle-chip` | A pill that turns on and off. A real button with `aria-pressed`. | `pressed?: boolean, onToggle: () => void, children?: React.ReactNode` |

### Formatting

| component | what it is for | props |
|---|---|---|
| `money` | An amount of money, in the visitor's locale. | `amount: number, currency?: string = "GBP"` |
| `number-format` | A number, grouped for the visitor's locale, optionally shortened to 1.2k. | `value: number, compact?: boolean, decimals?: number` |
| `date-format` | A date, localised, inside a real <time>. | `date: string \| number \| Date, style?: "short" \| "medium" \| "long" = "medium", withTime?: boolean` |
| `list-format` | "a, b and c" — with the right conjunction for the visitor's language. | `items: string[], type?: "conjunction" \| "disjunction" = "conjunction"` |
| `plural` | "1 booking" / "2 bookings", correctly. | `count: number, one: string, other: string, few?: string, showCount?: boolean = true` |
| `truncate-middle` | Cuts from the MIDDLE, keeping both ends. | `text: string, max?: number = 28` |
| `highlight-match` | Marks the matching part of a search result. | `text: string, query: string` |
| `file-size` | Bytes as something human. 1024-based, matching what an OS reports. | `bytes: number` |
| `ordinal` | "1st", "2nd", "3rd" — from Intl, so it is right outside English too. | `value: number` |
| `initials` | Initials from a name, for where an avatar is overkill. | `name: string, max?: number = 2` |

### More layout

| component | what it is for | props |
|---|---|---|
| `split-view` | A list beside a detail pane. | `list: React.ReactNode, detail: React.ReactNode, hasSelection?: boolean, listWidth?: string = "20rem"` |
| `panel` | A titled box. Lighter than `card` — no shadow, no padding round the header. | `title?: string, actions?: React.ReactNode, footer?: React.ReactNode, children?: React.ReactNode` |
| `well` | A recessed area — for a nested form or a quoted block of detail. | `children?: React.ReactNode` |
| `card-grid` | The grid cards sit in. A named default so every listing page matches. | `min?: number = 260, gap?: 2 \| 3 \| 4 \| 6 \| 8 = 4, children?: React.ReactNode` |
| `list-row` | One row of a list: something on the left, detail in the middle, action right. | `leading?: React.ReactNode, title: React.ReactNode, description?: React.ReactNode, trailing?: React.ReactNode, onClick?: () => void` |
| `media-object` | Something fixed-width beside flowing text. The oldest layout on the web. | `media: React.ReactNode, align?: "start" \| "center" = "start", reverse?: boolean, children?: React.ReactNode` |
| `empty-illustration` | A fuller empty state, with something to do about it. | `title: string, description?: string, action?: object, icon?: React.ReactNode` |
| `sidebar-layout` | Navigation on the left, content on the right. | `aside: React.ReactNode, width?: string = "14rem", children?: React.ReactNode` |
| `sticky-aside` | A panel that follows down the page — a booking box beside a long description. | `top?: string = "1.5rem", children?: React.ReactNode` |
| `centered-form` | The sign-in page shape: a mark, a title, the form, and a line underneath. | `brand?: React.ReactNode, title: string, description?: string, footer?: React.ReactNode, children?: React.ReactNode` |
| `section-divider` | A break between sections, optionally labelled. | `label?: string` |
| `grid-item` | Makes one cell span more than one column or row inside a grid. | `colSpan?: 1 \| 2 \| 3 \| 4 = 1, rowSpan?: 1 \| 2 \| 3 = 1, children?: React.ReactNode` |

## The fourth hundred (2026-07-30)

| component | what it is for | props |
|---|---|---|
| `file-type-icon` | An icon for a filename, from its extension. Unknown types get a plain file. | `name: string` |
| `file-row` | — | `name: string, size?: number, meta?: string \| null, href?: string, onRemove?: () => void` |
| `file-list` | Several files, with an honest empty state. | `files: object[], onRemove?: (name: string) => void, empty?: string = "No files yet"` |
| `upload-progress` | One upload in flight. | `name: string, percent: number, error?: string \| null, onCancel?: () => void, onRetry?: () => void` |
| `download-card` | A file offered for download, with its size stated before the click. | `name: string, description?: string, size?: number, href: string` |
| `attachment-list` | Attachments as chips, for under a message or a form. | `items: object[], onOpen?: (name: string) => void` |
| `storage-bar` | How much space is used, in real units rather than a bare percentage. | `used: number, total: number, label?: string = "Storage", warnAt?: number = 0.85` |

### Notifications and discussion

| component | what it is for | props |
|---|---|---|
| `notification-item` | One notification. Unread carried by weight and a dot, not colour alone. | `title: string, body?: string, at?: string \| number \| Date, unread?: boolean, who?: string, onClick?: () => void` |
| `notification-list` | The panel behind the bell, with a mark-all that only shows when it can do something. | `items: Notification[], onOpen?: (id: string) => void, onMarkAll?: () => void, empty?: string = "Nothing new"` |
| `notification-bell` | The bell with its count, opening a panel. The count is in the label too. | `count?: number = 0, children?: React.ReactNode` |
| `unread-divider` | The "new" line in a list. Announced, not just drawn. | `label?: string = "New"` |
| `comment` | One comment: who, when, what, and what you can do about it. | `author: string, at?: string \| number \| Date, body: React.ReactNode, avatar?: string \| null, actions?: React.ReactNode, edited?: boolean` |
| `comment-thread` | Replies, indented ONE level only. | `root: React.ReactNode, replies?: React.ReactNode[]` |
| `reply-box` | Write a reply. | `onSubmit: (body: string) => void, busy?: boolean, placeholder?: string = "Write a reply…", max?: number = 1000` |
| `mention-chip` | An @name inside body text. A link when there is somewhere to go. | `name: string, href?: string` |
| `moderation-note` | Stands in for content that was removed. | `reason?: string = "This comment was removed."` |

### Tables at scale

| component | what it is for | props |
|---|---|---|
| `page-size-select` | Rows per page. Sits beside a pager, so it is labelled inline rather than above. | `value: number, onChange: (n: number) => void, options?: number[] = [10, 25, 50, 100], id?: string = "page-size"` |
| `row-select` | The checkbox cell of a selectable table. | `checked: boolean, onCheckedChange: (v: boolean) => void, label: string` |
| `select-all-banner` | "All 25 on this page are selected — select all 1,340?" | `pageCount: number, totalCount: number, allSelected?: boolean, onSelectAll: () => void, onClear: () => void` |
| `expandable-row` | A table row that opens a detail panel underneath itself. | `colSpan: number, summary: React.ReactNode, detail: React.ReactNode, defaultOpen?: boolean` |
| `totals-row` | The footer row of a table of numbers. | `label?: string = "Total", cells: React.ReactNode[]` |
| `grouped-rows` | A section heading inside a table body — "March", "Overdue", "Unassigned". | `label: string, count?: number, colSpan: number, children?: React.ReactNode` |
| `table-skeleton` | Placeholder rows while a table loads. | `rows?: number = 5, columns?: number = 4` |
| `sticky-table` | A wide table that scrolls sideways with its first column pinned. | `children?: React.ReactNode` |
| `density-toggle` | Row height. Three steps, because two is not enough choice and five is a menu. | `value: Density, onChange: (d: Density) => void` |
| `inline-edit` | A value that becomes an input when clicked. | `value: string, onSave: (v: string) => void, label?: string, placeholder?: string` |

### Charts, hand-drawn in SVG and CSS

| component | what it is for | props |
|---|---|---|
| `sparkline` | A trend line, inline, with no charting library. | `values: number[], width?: number = 96, height?: number = 24, label?: string` |
| `mini-bars` | A tiny bar column — days of the week, hours of the day. | `values: number[], height?: number = 28, label?: string, highlight?: number` |
| `bar-list` | Labelled horizontal bars — top pages, top sources, best sellers. | `items: object[], valueLabel?: (n: number) => string` |
| `donut-mini` | A single-value ring with the number in the middle. | `value: number, max?: number = 100, size?: number = 56, label?: string` |
| `gauge` | A half-dial for a bounded reading — capacity, score, load. | `value: number, min?: number = 0, max?: number = 100, unit?: string, label?: string, size?: number = 120` |
| `heat-strip` | A row of intensity cells — busiest hours, activity per day. | `values: number[], labels?: string[], label?: string` |
| `ratio-bar` | A share-of-total bar with a written legend. | `parts: { label: string; value: number }[]` |
| `dot-plot` | Where each row sits on a shared scale — price against the range, score against the class. | `items: { label: string; value: number }[], min?: number, max?: number, format?: (n: number) => string` |
| `progress-stack` | A segmented progress bar — steps done, in progress, and left. | `segments: object[], total?: number` |
| `trend-arrow` | The direction on its own, for a table cell where `MetricDelta` (number and arrow together) would not fit. | `direction: "up" \| "down" \| "flat", good?: boolean, label?: string` |

### Onboarding and first run

| component | what it is for | props |
|---|---|---|
| `welcome-card` | The first thing somebody sees. One primary action, one way out. | `title: string, body?: string, action?: string, onAction?: () => void, onSkip?: () => void` |
| `setup-checklist` | "3 of 5 done" — the setup list. | `steps: object[], title?: string = "Get set up"` |
| `spotlight` | Dims the page and lifts one thing out of it. | `active: boolean, onDismiss?: () => void, children?: React.ReactNode` |
| `whats-new` | A short list of recent changes. Newest first, dated, no version numbers. | `items: object[], title?: string = "What's new"` |
| `sample-data-banner` | "These are examples." Says so on the page rather than in a tooltip, because the failure this prevents is somebody sending a customer a demo invoice. | `label?: string = "This is sample data, added so the page has something to show.", actionLabel?: string = "Clear samples", onAction?: () => void` |
| `getting-started` | A grid of first things to do. Each tile is a link, not a card with a button inside it. | `items: object[]` |
| `connect-card` | One integration: what it is, whether it is on, and the one button that changes that. | `name: string, description?: string, logo?: string \| null, connected?: boolean, account?: string \| null, onConnect?: () => void, onDisconnect?: () => void` |
| `first-run` | The empty state of a list nobody has used yet. | `title: string, body?: string, action?: string, onAction?: () => void, secondary?: string, onSecondary?: () => void, icon?: React.ReactNode` |

### Search

| component | what it is for | props |
|---|---|---|
| `search-header` | "142 results for barber" plus whatever controls belong beside it. | `query?: string, count?: number, loading?: boolean, children?: React.ReactNode` |
| `search-results` | A list of hits: title, one line of context, where it came from. | `results: object[], query?: string` |
| `recent-searches` | The last few queries. | `items: string[], onSelect: (q: string) => void, onRemove?: (q: string) => void, onClear?: () => void` |
| `search-suggestions` | The dropdown under a search box. | `items: { label: string; hint?: string }[], query?: string, activeIndex?: number = -1, onSelect: (label: string, index: number) => void` |
| `no-results` | Nothing matched — and what to try instead. | `query?: string, suggestions?: string[], onSuggestion?: (q: string) => void, onClearFilters?: () => void` |
| `search-facets` | A facet group with counts — Category, Price, Brand. | `title: string, options: object[], selected: string[], onToggle: (value: string) => void` |
| `sort-select` | Sort order for a list. A plain select, because six orderings is not a menu worth building. | `value: string, onChange: (v: string) => void, options: { value: string; label: string }[], id?: string = "sort"` |
| `applied-filters` | The filters currently narrowing a list, each removable. | `filters: object[], onRemove: (key: string) => void, onClearAll?: () => void` |

### Settings and account admin

| component | what it is for | props |
|---|---|---|
| `settings-nav` | The left rail of a settings page, grouped. | `groups: object[], current: string, onSelect?: (key: string) => void` |
| `setting-item` | One setting: name, explanation, control. | `label: string, description?: string, htmlFor?: string, children?: React.ReactNode` |
| `notification-prefs` | The email/push grid — one row per event, one column per channel. | `channels: { key: string; label: string }[], rows: object[], value: Record<string, string[]>, onChange: function` |
| `api-key-row` | A key that has already been issued. | `name: string, prefix: string, createdAt?: string \| number \| Date, lastUsed?: string \| number \| Date \| null, onRevoke?: () => void` |
| `webhook-row` | One endpoint, its events, and whether it is actually working. | `url: string, events?: string[], state?: "on" \| "pending" \| "off" \| "error" = "on", lastDeliveryAt?: string \| number \| Date \| null, lastError?: string \| null, onEdit?: () => void, onDelete?: () => void` |
| `connected-account` | A sign-in method attached to an account — Google, Apple, a passkey. | `provider: string, identity?: string \| null, avatar?: string \| null, canRemove?: boolean = true, onRemove?: () => void` |
| `billing-summary` | The plan, the next charge, and the way out. | `plan: string, amount?: number, currency?: string, interval?: "month" \| "year" = "month", renewsAt?: string \| number \| Date \| null, cancelAt?: string \| number \| Date \| null, onChange?: () => void, onCancel?: () => void` |
| `invoice-row` | One line of billing history. Status is written, not only coloured. | `number: string, date: string \| number \| Date, amount: number, currency?: string, status?: "paid" \| "due" \| "failed" \| "refunded" = "paid", href?: string` |
| `seat-usage` | "8 of 10 seats used." | `used: number, total: number, onAdd?: () => void` |
| `two-factor-setup` | Turning on an authenticator app. | `secret: string, qrSrc?: string \| null, code: string, onCodeChange: (v: string) => void, onVerify: () => void, error?: string \| null, busy?: boolean` |
| `email-verify-banner` | "Confirm your email." | `email?: string, sent?: boolean, onResend?: () => void, busy?: boolean` |

### System status

| component | what it is for | props |
|---|---|---|
| `uptime-bar` | Ninety days of service, one bar per day. | `days: object[], label?: string` |
| `incident-item` | One incident and its updates. | `title: string, status?: "investigating" \| "identified" \| "monitorin… = "investigating", updates?: object[], startedAt?: string \| number \| Date` |
| `status-list` | Every component of a service, with the headline computed from them. | `items: object[]` |
| `maintenance-notice` | Planned downtime, with the window in the reader's own timezone. | `start: string \| number \| Date, end?: string \| number \| Date \| null, body?: string` |
| `latency-badge` | A response time with a judgement attached. | `ms: number, ok?: number = 300, slow?: number = 1000` |
| `sync-status` | "Saved", "Saving…", "Couldn't save". | `state: "idle" \| "syncing" \| "saved" \| "error", at?: string \| number \| Date \| null, onRetry?: () => void` |
| `queue-depth` | How much work is waiting, and whether that is getting better or worse. | `label: string, depth: number, history?: number[], oldest?: string` |

### Events and calendars

| component | what it is for | props |
|---|---|---|
| `event-card` | — | `title: string, start: string \| number \| Date, venue?: string, image?: string \| null, price?: string, soldOut?: boolean, href?: string, onBook?: () => void` |
| `agenda-list` | A day's schedule, grouped under date headings. | `items: object[], empty?: string = "Nothing scheduled."` |
| `time-slot` | One bookable time. | `time: string, taken?: boolean, selected?: boolean, onSelect?: () => void, note?: string` |
| `rsvp-buttons` | Going / maybe / can't. | `value?: Rsvp \| null, onChange: (v: Rsvp) => void, counts?: Partial<Record<Rsvp, number>>` |
| `event-meta` | The facts line under an event title. | `start?: string \| number \| Date, end?: string \| number \| Date \| null, venue?: string, capacity?: string, price?: string` |
| `all-day-row` | The band above a day view for things with no time — holidays, deadlines, someone being away. | `items: object[]` |
| `date-nav` | Previous / Today / Next above a calendar. | `label: string, onPrev: () => void, onNext: () => void, onToday?: () => void, unit?: "day" \| "week" \| "month" = "day"` |
| `now-line` | The "you are here" line across a day timetable. | `dayStart?: number = 8, dayEnd?: number = 20, date?: Date` |
| `ics-button` | "Add to calendar" — builds the .ics file in the browser. | `title: string, start: string \| number \| Date, end?: string \| number \| Date \| null, location?: string, description?: string, label?: string = "Add to calendar"` |

### The trades

| component | what it is for | props |
|---|---|---|
| `job-card` | — | `title: string, team?: string, location?: string, type?: string, salary?: string, postedAt?: string \| number \| Date, href?: string, tags?: string[]` |
| `property-card` | A place to rent or buy. | `price: string, address: string, beds?: number, baths?: number, area?: string, image?: string \| null, status?: string, href?: string` |
| `course-card` | A course, in a catalogue or on the student's own shelf. | `title: string, teacher?: string, lessons?: number, duration?: string, level?: string, price?: string, progress?: number \| null, image?: string \| null, href?: string` |
| `recipe-card` | — | `title: string, image?: string \| null, totalTime?: string, serves?: number, rating?: number, tags?: string[], href?: string` |
| `dish-card` | A menu item with a photograph — the café case, where `PriceList` (a text row) is not enough. | `name: string, description?: string, price?: string, image?: string \| null, tags?: string[], unavailable?: boolean` |
| `service-card` | A bookable service — a haircut, a treatment, a lesson. | `name: string, description?: string, price?: string, duration?: string, image?: string \| null, onBook?: () => void, bookLabel?: string = "Book"` |
| `room-card` | A room — a hotel booking, a venue hire, a studio. | `name: string, description?: string, price?: string, per?: string = "night", sleeps?: number, size?: string, image?: string \| null, amenities?: string[], onBook?: () => void` |
| `vehicle-card` | A vehicle for sale or hire. | `title: string, price?: string, image?: string \| null, specs?: { label: string; value: string }[], badge?: string, href?: string` |
| `ticket-card` | A ticket somebody already holds. | `event: string, reference: string, at?: string \| number \| Date, seat?: string, holder?: string, used?: boolean` |
| `donation-card` | Give to a cause. | `title: string, raised?: number, goal?: number, currency?: string = "£", presets?: number[] = [10, 25, 50, 100], onDonate?: (amount: number) => void` |
| `membership-card` | Somebody's membership — a gym, a club, a library. | `name: string, tier?: string, number?: string, since?: string \| number \| Date, expires?: string \| number \| Date, expired?: boolean` |

### More inputs and utility

| component | what it is for | props |
|---|---|---|
| `tag-input` | Type a word, press Enter, get a chip. | `value: string[], onChange: (tags: string[]) => void, placeholder?: string = "Add a tag…", max?: number, id?: string` |
| `slug-input` | A URL-safe name, shown in place. | `value: string, onChange: (v: string) => void, from?: string, prefix?: string, id?: string` |
| `unit-input` | A number and the unit it is in — 30 minutes, 2 kg, 500 ml. | `value: string, unit: string, units: { value: string; label: string }[], onValueChange: (v: string) => void, onUnitChange: (u: string) => void, id?: string, placeholder?: string` |
| `weekday-picker` | Which days something happens on. | `value: number[], onChange: (days: number[]) => void` |
| `color-swatch` | A colour, with its value written next to it. | `color: string, name?: string, selected?: boolean, onSelect?: () => void` |
| `id-badge` | A reference, shortened, that copies in FULL. | `id: string, head?: number = 6, tail?: number = 0, label?: string = "Copy id"` |
| `json-view` | Readable JSON — a webhook payload, a stored answer, a debug panel. | `value: unknown, collapsedHeight?: number = 320` |
| `diff-text` | What changed between two versions of a short piece of text. | `before: string, after: string` |
| `word-count` | Words and reading time under a text box. | `text: string, min?: number` |
| `map-embed` | Where a place is. | `address: string, embedSrc?: string \| null, label?: string = "Open in Maps"` |

## The fifth hundred (2026-07-30)

| component | what it is for | props |
|---|---|---|
| `chat-message` | One message in a conversation. | `body: React.ReactNode, own?: boolean, author?: string, at?: string \| number \| Date, avatar?: string \| null, status?: React.ReactNode` |
| `chat-thread` | The scrolling body of a conversation. | `children?: React.ReactNode` |
| `chat-composer` | The box you type into. | `onSend: (body: string) => void, busy?: boolean, placeholder?: string = "Write a message…", maxRows?: number = 6` |
| `typing-indicator` | "Ada is typing." | `who?: string \| string[]` |
| `message-status` | Sending / sent / delivered / read / failed. | `state: "sending" \| "sent" \| "delivered" \| "read" \|…` |
| `conversation-row` | One conversation in an inbox. | `name: string, preview?: string, at?: string \| number \| Date, unread?: number = 0, avatar?: string \| null, active?: boolean, onClick?: () => void` |
| `help-launcher` | The corner bubble that opens help. | `label?: string = "Help", children?: React.ReactNode` |
| `canned-reply` | Saved replies, inserted with one press. | `replies: { label: string; body: string }[], onInsert: (body: string) => void` |
| `contact-form` | Name, email, message — the form nearly every site has. | `onSubmit: function, busy?: boolean, error?: string \| null, sent?: boolean, askPhone?: boolean` |
| `ticket-row` | A support ticket in a queue. | `id: string, subject: string, requester?: string, state?: "open" \| "pending" \| "resolved" \| "closed" = "open", lastReplyAt?: string \| number \| Date, assignee?: string \| null, onClick?: () => void` |
| `sla-badge` | How long is left to answer — or how long it is already overdue. | `dueAt: string \| number \| Date, warnMinutes?: number = 60` |
| `escalation-note` | "Passed to Grace, 20 minutes ago — customer called twice." | `to: string, from?: string, at?: string \| number \| Date, reason?: string` |

### Documents, invoices and print

| component | what it is for | props |
|---|---|---|
| `invoice-header` | Who is billing whom, for what, and by when. | `number: string, issuedAt?: string \| number \| Date, dueAt?: string \| number \| Date, from?: object, to?: { name: string; lines?: string[] }, logo?: string \| null, reference?: string` |
| `invoice-lines` | What is being charged for. | `lines: InvoiceLine[], currency?: string = "GBP"` |
| `invoice-totals` | Subtotal, tax, discount, total — and what is still owed. | `subtotal?: number, tax?: number, taxLabel?: string = "VAT", discount?: number, total: number, paid?: number, currency?: string = "GBP"` |
| `receipt` | Proof something was paid — the thing sent AFTER, not the request for money. | `number: string, paidAt?: string \| number \| Date, total: number, currency?: string = "GBP", method?: string, last4?: string, items?: { label: string; amount: number }[], business?: string` |
| `letterhead` | The masthead of a printed document. | `name: string, logo?: string \| null, lines?: string[], contact?: { label: string; value: string }[]` |
| `signature-block` | Where a document is signed. | `name?: string, role?: string, signedAt?: string \| number \| Date, signature?: string \| null, label?: string = "Signed"` |
| `terms-block` | The small print at the foot of a document. | `title?: string = "Terms", clauses: string[]` |
| `document-meta` | Version, status and date, for a document that has more than one of each. | `items: object[]` |
| `page-break` | Start a new sheet here when printed. | `children?: React.ReactNode` |
| `print-only` | Content only a printed copy gets — a URL written out, a reference, terms. | `children?: React.ReactNode` |
| `screen-only` | Content a printed copy should not get — buttons, navigation, a cookie bar. | `children?: React.ReactNode` |
| `watermark` | DRAFT, COPY, VOID — across a document, on screen and on paper. | `text?: string = "DRAFT", children?: React.ReactNode` |
| `multi-step-form` | The shell around a form split over several screens. | `steps: string[], current: number, onBack?: () => void, onNext?: () => void, onSubmit?: () => void, nextLabel?: string, busy?: boolean, canContinue?: boolean = true, children?: React.ReactNode` |
| `form-progress` | The numbered rail beside a long form. | `steps: string[], current: number, onGoTo?: (i: number) => void` |
| `repeatable-field` | "Add another" — a list of the same field repeated. | `label: string, count: number, min?: number = 1, max?: number = 10, addLabel?: string, onAdd: () => void, onRemove: (index: number) => void, children: (index: number) => React.ReactNode` |
| `conditional-field` | A field that appears once something else is answered. | `when: boolean, label?: string, children?: React.ReactNode` |
| `signature-pad` | Sign with a finger or a mouse. | `onChange?: (dataUrl: string \| null) => void, height?: number = 160` |
| `consent-checkbox` | "I agree to the terms." | `checked: boolean, onCheckedChange: (v: boolean) => void, id?: string = "consent", children?: React.ReactNode, error?: string \| null` |
| `date-of-birth` | Three fields, deliberately NOT a date picker. | `value: { day: string; month: string; year: string }, onChange: function, id?: string = "dob"` |
| `time-input` | A time of day. | `value: string, onChange: (v: string) => void, id?: string, min?: string, max?: string, step?: number = 300` |
| `range-input` | A from-and-to pair — price, age, weight. | `from: string, to: string, onFromChange: (v: string) => void, onToChange: (v: string) => void, id?: string = "range", unit?: string, min?: number, max?: number` |
| `scale-input` | An agree-to-disagree scale. | `name: string, value?: number \| null, onChange: (v: number) => void, points?: number = 5, lowLabel?: string, highLabel?: string` |
| `matrix-question` | One question per row, one answer per column. | `name: string, rows: { key: string; label: string }[], columns: { value: string; label: string }[], value: Record<string, string>, onChange: (rowKey: string, v: string) => void` |
| `honeypot` | A spam trap. A field a person never sees and a bot fills in. | `name?: string = "_gotcha"` |
| `save-draft` | Keeps a long form in localStorage while it is being filled in. | — |
| `error-boundary` | Catches a crash in the tree below it and shows something instead of a blank page. | — |
| `not-found` | The page for a URL that does not exist. | `title?: string = "We can't find that page", body?: string, homeHref?: string = "/", onSearch?: () => void` |
| `forbidden` | "You are signed in, and this is not yours." | `title?: string = "You don't have access to this", body?: string, onBack?: () => void, onSwitchAccount?: () => void` |
| `rate-limited` | "Too many attempts — try again in 40 seconds." | `seconds: number, onRetry?: () => void, message?: string` |
| `maintenance-page` | The whole site is down on purpose. | `backAt?: string \| number \| Date, body?: string, contact?: { label: string; href: string }` |
| `stale-data-note` | "These numbers are from 20 minutes ago." | `at: string \| number \| Date, afterMinutes?: number = 5, onRefresh?: () => void` |
| `slow-note` | "This is taking longer than usual." | `loading: boolean, afterMs?: number = 4000, message?: string` |
| `undo-toast` | "Deleted. Undo" — the alternative to an "are you sure?" dialog. | `message: string, onCommit: () => void, onUndo?: () => void, seconds?: number = 6` |
| `conflict-note` | "Somebody else changed this while you were editing." | `who?: string, at?: string \| number \| Date, onKeepMine?: () => void, onTakeTheirs?: () => void, onCompare?: () => void` |
| `partial-failure` | "18 of 20 went through." | `succeeded: number, failed: number, failures?: { label: string; reason?: string }[], onRetryFailed?: () => void` |

### Accessibility and page structure

| component | what it is for | props |
|---|---|---|
| `skip-link` | "Skip to content" — the first thing in the tab order, invisible until focused. | `href?: string = "#main", label?: string = "Skip to content"` |
| `live-region` | Announces a message to a screen reader without showing anything. | `message?: string \| null, urgency?: "polite" \| "assertive" = "polite"` |
| `focus-trap` | Keeps Tab inside a region while it is open, and gives focus back when it closes. | `active?: boolean = true, children?: React.ReactNode` |
| `heading-level` | A heading that knows how deep it is. | `children?: React.ReactNode · children?: React.ReactNode` |
| `lang-switch` | Choose a language. | `value: string, onChange: (code: string) => void, languages: { code: string; label: string }[], id?: string = "lang"` |
| `text-size` | Bigger text, for a page of it. | — |
| `landmark` | The page skeleton, with real landmark elements. | `children?: React.ReactNode · label: string, children?: React.ReactNode · label?: string, children?: React.ReactNode` |
| `seo-jsonld` | Structured data — what puts opening hours, a price and a star rating into a Google result rather than just a blue link. | `data: Record<string, unknown> \| Record<string, un…` |
| `share-preview` | What this page will look like when somebody pastes the link into WhatsApp. | `title: string, description?: string, image?: string \| null, domain?: string` |
| `page-title` | Sets `document.title` for a route. | `title: string, suffix?: string` |

### Location and delivery

| component | what it is for | props |
|---|---|---|
| `store-locator` | The branch list. | `stores: object[], onDirections?: (id: string \| number) => void` |
| `distance-badge` | How far away something is. | `metres: number` |
| `service-area` | "Do you come out to me?" | `areas: string[], note?: string, placeholder?: string = "Your postcode or town"` |
| `travel-time` | "8 min walk · 4 min drive." | `modes: object[]` |
| `postcode-input` | A postal code. | `value: string, onChange: (v: string) => void, id?: string, placeholder?: string = "Postcode"` |
| `pickup-point` | Collect it from here. | `name: string, address: string, hours?: string, note?: string, selected?: boolean, onSelect?: () => void` |
| `delivery-slot` | A delivery window to choose. | `day: string, window: string, price?: number, currency?: string, full?: boolean, selected?: boolean, onSelect?: () => void` |
| `shipping-options` | Standard, express, collection. | `name?: string = "shipping", options: object[], value?: string, onChange: (v: string) => void, currency?: string` |
| `address-summary` | A confirmed address, read back before something is sent to it. | `name?: string, lines?: (string \| null \| undefined)[], postcode?: string, country?: string, onEdit?: () => void` |
| `country-select` | Choose a country. | `value: string, onChange: (code: string) => void, id?: string, priority?: string[] = ["GB", "US", "IE"]` |

### Getting existing data in

| component | what it is for | props |
|---|---|---|
| `csv-import` | Take a CSV and hand back rows. | `onRows: (rows: string[][], fileName: string) => void, maxBytes?: number = 5 * 1024 * 1024` |
| `column-mapper` | "Which of your columns is the email address?" | `fields: object[], headers: string[], mapping: Record<string, string>, onChange: (fieldKey: string, header: string) => void, sample?: Record<string, string>` |
| `import-preview` | The first few rows, as they will actually be imported. | `columns: string[], rows: Record<string, string>[], total?: number` |
| `paste-table` | Paste straight out of a spreadsheet. | `onRows: (rows: string[][]) => void, label?: string = "Paste your rows", rows?: number` |
| `import-summary` | What the import actually did. | `added?: number = 0, updated?: number = 0, skipped?: number = 0, failed?: number = 0` |
| `batch-progress` | "312 of 1,204." | `done: number, total: number, label?: string, failed?: number = 0, onStop?: () => void` |
| `row-errors` | Which rows failed, by line number, and why. | `errors: object[], max?: number = 20` |
| `dry-run-note` | "Nothing has been saved yet." | `actionLabel: string, onCommit: () => void, onCancel?: () => void, busy?: boolean, note?: string` |
| `dedupe-list` | "These two look like the same person." | `pairs: object[], onMerge?: function, onKeepBoth?: (id: string \| number) => void` |
| `template-download` | "Download a template" — the blank CSV with the right headers in it. | `fields: { key: string; label: string }[], fileName?: string = "import-template.csv", example?: Record<string, string>, label?: string = "Download a template"` |

### Time and availability

| component | what it is for | props |
|---|---|---|
| `open-now` | "Open now — until 6pm" / "Closed — opens 9am tomorrow." | `hours: { day: number; open: string; close: string }[], now?: Date` |
| `holiday-notice` | "Closed 24–27 December." | `from: string \| number \| Date, to?: string \| number \| Date \| null, reason?: string = "We're closed", note?: string, showDaysBefore?: number = 21` |
| `lead-time` | "Order by 2pm for next-day delivery" — and what happens after that. | `cutoffHour: number, cutoffMinute?: number = 0, before: string, after: string, now?: Date` |
| `blackout-dates` | Days nothing can be booked on — holidays, a deep clean, someone away. | `dates: (string \| number \| Date)[], onRemove?: (iso: string) => void, empty?: string = "No dates blocked."` |
| `shift-badge` | Which shift somebody is on. | `start: string, end: string, label?: string` |
| `time-until` | A live count to a moment — "in 2h 14m", ticking. | `date: string \| number \| Date, past?: string = "now"` |
| `slot-hold` | "We're holding 2pm for another 8:32." | `until: string \| number \| Date, onExpire?: () => void, label?: string` |
| `timezone-picker` | Choose a timezone. | `value: string, onChange: (tz: string) => void, zones?: string[], id?: string` |
| `recurrence-summary` | Says a repeating rule in words — "every 2 weeks on Tuesday and Thursday, until 14 August". | `freq: "day" \| "week" \| "month" \| "year", interval?: number = 1, days?: number[], until?: string \| number \| Date \| null, count?: number \| null` |
| `duration-bar` | How a block of time is made up — 20 min cut, 10 min wash, 15 min finish. | `segments: { label: string; minutes: number }[]` |
| `date-badge` | The calendar-tile date — big day over small month. | `date: string \| number \| Date, size?: "sm" \| "md" \| "lg" = "md"` |

### People and org

| component | what it is for | props |
|---|---|---|
| `person-row` | A person in a directory or a team list. | `name: string, role?: string, email?: string, phone?: string, avatar?: string \| null, presence?: "online" \| "away" \| "busy" \| "offline", actions?: React.ReactNode` |
| `presence-dot` | Whether a PERSON is around — online, away, busy, offline. | `state?: "online" \| "away" \| "busy" \| "offline" = "offline", label?: string, showLabel?: boolean = true, ring?: boolean` |
| `role-badge` | What somebody is allowed to do — Owner, Admin, Member, Viewer. | `role: string, pending?: boolean` |
| `org-chart` | Who reports to whom. | `nodes: OrgNode[], maxDepth?: number = 8` |
| `skill-tags` | What somebody can do — the services a stylist offers, a trade's certifications. | `skills: string[], max?: number = 5` |
| `on-call` | Who is covering right now, and until when. | `name?: string \| null, role?: string, phone?: string, until?: string \| number \| Date, avatar?: string \| null, empty?: string = "Nobody is on call."` |
| `handoff-note` | What the last shift left for the next one. | `author: string, at?: string \| number \| Date, body?: string, open?: string[], avatar?: string \| null` |
| `availability-legend` | What the shading on a rota or a booking grid means. | `items: { label: string; swatch: string }[]` |
| `capacity-bar` | How full somebody's day or a room already is. | `used: number, capacity: number, unit?: string = "hrs", label?: string` |
| `mention-picker` | The @-list that appears while typing a name. | `people: object[], query?: string, activeIndex?: number = 0, onPick: function` |
| `directory-list` | A searchable list of people, grouped by first letter. | `people: { id: string \| number; name: string }[], renderPerson: function, placeholder?: string = "Search people"` |
| `approval-chain` | Who has signed off and who has not. | `steps: object[]` |

