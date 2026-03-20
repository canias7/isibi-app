import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, PenLine, CalendarDays, FileText, Megaphone,
  BarChart2, Sparkles, Copy, Check, Clock, TrendingUp,
  Hash, RefreshCw, Plus, Heart, MessageCircle, ThumbsUp,
  Share2, Edit3, Trash2, Eye, Flame, Star,
  BookOpen, ChevronLeft, ChevronRight, ArrowLeft,
  Send, Globe, CheckCircle2, Wand2, Image, Download,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { generateSocialContent, generateSocialImage } from "@/lib/api";

// ── Platform config ────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: "instagram", label: "Instagram", charLimit: 2200, gradient: "from-pink-500 via-purple-500 to-orange-400", bg: "bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-orange-400/10", border: "border-pink-500/30", text: "text-pink-500", emoji: "📸", mockupBg: "bg-gradient-to-br from-pink-950/40 to-purple-950/40", engagementIcons: [Heart, MessageCircle, Send] },
  { id: "twitter", label: "Twitter / X", charLimit: 280, gradient: "from-sky-400 to-blue-600", bg: "bg-sky-400/10", border: "border-sky-400/30", text: "text-sky-400", emoji: "𝕏", mockupBg: "bg-sky-950/40", engagementIcons: [Heart, RefreshCw, MessageCircle, Share2] },
  { id: "linkedin", label: "LinkedIn", charLimit: 1300, gradient: "from-blue-600 to-blue-800", bg: "bg-blue-600/10", border: "border-blue-600/30", text: "text-blue-500", emoji: "in", mockupBg: "bg-blue-950/40", engagementIcons: [ThumbsUp, MessageCircle, Share2] },
  { id: "facebook", label: "Facebook", charLimit: 63206, gradient: "from-blue-500 to-blue-700", bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", emoji: "f", mockupBg: "bg-blue-900/30", engagementIcons: [ThumbsUp, Heart, MessageCircle, Share2] },
  { id: "tiktok", label: "TikTok", charLimit: 2200, gradient: "from-teal-400 to-pink-500", bg: "bg-teal-400/10", border: "border-teal-400/30", text: "text-teal-400", emoji: "♪", mockupBg: "bg-teal-950/40", engagementIcons: [Heart, MessageCircle, Share2, Star] },
];

const TONES = ["Professional", "Casual", "Inspirational", "Funny", "Educational", "Urgent", "Empathetic", "Bold"];

const IMAGE_STYLES = [
  { id: "photorealistic", label: "Photorealistic", emoji: "📷" },
  { id: "illustration", label: "Illustration", emoji: "🎨" },
  { id: "minimalist", label: "Minimalist", emoji: "⬜" },
  { id: "corporate", label: "Corporate", emoji: "💼" },
  { id: "artistic", label: "Artistic", emoji: "🖌️" },
  { id: "3d-render", label: "3D Render", emoji: "🌐" },
  { id: "flat-design", label: "Flat Design", emoji: "🔷" },
  { id: "vintage", label: "Vintage", emoji: "📸" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "Square (1:1)", hint: "Instagram" },
  { id: "9:16", label: "Portrait (9:16)", hint: "Stories/TikTok" },
  { id: "16:9", label: "Landscape (16:9)", hint: "Twitter/LinkedIn" },
  { id: "4:5", label: "Portrait (4:5)", hint: "Instagram Feed" },
];

// Auto-selects the best model for each style — not exposed to the user
const STYLE_MODEL_MAP: Record<string, string> = {
  "photorealistic": "realistic-vision",
  "illustration":   "dreamshaper",
  "minimalist":     "flux-schnell",
  "corporate":      "flux-schnell",
  "artistic":       "dreamshaper",
  "3d-render":      "sdxl",
  "flat-design":    "flux-schnell",
  "vintage":        "dreamshaper",
};

// ── 60+ Templates ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  // ── Marketing & Sales (10) ──
  { id: 1, title: "Product Launch", category: "Marketing", icon: "🚀", platforms: ["instagram", "twitter", "linkedin", "facebook"], preview: "Exciting news! We're thrilled to introduce [Product Name] — the solution you've been waiting for. Here's what makes it different from everything else on the market...", tags: ["launch", "product"] },
  { id: 2, title: "Limited Time Offer", category: "Marketing", icon: "⏰", platforms: ["instagram", "facebook", "twitter"], preview: "⏰ LAST CHANCE! Our [X]% off sale ends [date]. Don't miss out on [Product/Service]. Tap the link to grab yours before it's gone!", tags: ["sale", "urgency"] },
  { id: 3, title: "New Feature Drop", category: "Marketing", icon: "✨", platforms: ["linkedin", "twitter", "instagram"], preview: "We've been listening. We've been building. Introducing [Feature Name] — designed to help you [achieve result] faster than ever. Now live for all users.", tags: ["feature", "product"] },
  { id: 4, title: "Free Trial CTA", category: "Marketing", icon: "🎁", platforms: ["linkedin", "facebook", "twitter"], preview: "What if you could [solve problem] in half the time? Try [Product] free for 14 days and see the difference for yourself. No credit card required.", tags: ["trial", "cta"] },
  { id: 5, title: "Referral Program", category: "Marketing", icon: "🤝", platforms: ["instagram", "facebook", "linkedin"], preview: "Know someone who would love [Product]? Refer a friend and you BOTH get [reward]! The more you share, the more you earn. Link in bio 👇", tags: ["referral", "growth"] },
  { id: 6, title: "Before & After", category: "Marketing", icon: "🔄", platforms: ["instagram", "facebook", "tiktok"], preview: "BEFORE: [Pain point / struggle]. AFTER: [Transformation]. This is the reality for our customers every day. Ready for your transformation? DM us to get started.", tags: ["transformation", "results"] },
  { id: 7, title: "Price Drop Alert", category: "Marketing", icon: "💰", platforms: ["instagram", "twitter", "facebook"], preview: "We just dropped the price on [Product]! 🎉 Was [old price], now just [new price]. Same great quality, now even more accessible. Link in bio!", tags: ["price", "deal"] },
  { id: 8, title: "Waitlist Opening", category: "Marketing", icon: "📋", platforms: ["twitter", "linkedin", "instagram"], preview: "Something big is coming. We're building [Product/Feature] and spots are extremely limited. Join the waitlist now to be first in line 🔔 Link in bio.", tags: ["waitlist", "launch"] },
  { id: 9, title: "Bundle Deal", category: "Marketing", icon: "📦", platforms: ["instagram", "facebook"], preview: "Why choose one when you can have them all? Our [Bundle Name] includes [product 1], [product 2], and [product 3] — all at one unbeatable price. Limited availability!", tags: ["bundle", "value"] },
  { id: 10, title: "Partnership Announcement", category: "Marketing", icon: "🌟", platforms: ["linkedin", "twitter", "instagram"], preview: "Big news! We've partnered with [Partner] to bring you [benefit]. Together, we're making [goal] easier than ever. Here's what this means for you...", tags: ["partnership", "announcement"] },

  // ── Engagement & Community (10) ──
  { id: 11, title: "This or That", category: "Engagement", icon: "🆚", platforms: ["instagram", "twitter", "facebook"], preview: "This or That? ☕ Coffee or 🍵 Tea? Comment below and tell us why! We're a [team preference] — but we want to hear from our community!", tags: ["poll", "fun"] },
  { id: 12, title: "Caption Contest", category: "Engagement", icon: "💬", platforms: ["instagram", "facebook"], preview: "We challenge you! Drop the best caption for this photo below 👇 The most creative one wins [prize]. Tag a friend who'd nail this challenge! 😂", tags: ["contest", "fun"] },
  { id: 13, title: "Community Question", category: "Engagement", icon: "🙋", platforms: ["linkedin", "facebook", "twitter"], preview: "Let's hear from you! [Question related to your industry]? Drop your answer in the comments — we read every single one and love hearing your perspective.", tags: ["question", "community"] },
  { id: 14, title: "Fill in the Blank", category: "Engagement", icon: "📝", platforms: ["instagram", "twitter", "facebook"], preview: "Fill in the blank: The best thing about [topic] is ________. Comment below! We'll feature the best responses in our next post 👇", tags: ["interactive", "engagement"] },
  { id: 15, title: "Milestone Celebration", category: "Engagement", icon: "🎉", platforms: ["instagram", "linkedin", "facebook"], preview: "WE DID IT! 🎊 We just hit [milestone] and we couldn't have done it without YOU. Thank you for being part of this incredible journey. Here's to what comes next!", tags: ["milestone", "gratitude"] },
  { id: 16, title: "Giveaway", category: "Engagement", icon: "🎁", platforms: ["instagram", "facebook"], preview: "GIVEAWAY TIME! 🎉 We're giving away [prize] to one lucky winner! To enter:\n❤️ Like this post\n👤 Follow us\n🏷️ Tag 2 friends below!\nWinner announced [date]!", tags: ["giveaway", "contest"] },
  { id: 17, title: "Ask Me Anything", category: "Engagement", icon: "❓", platforms: ["instagram", "twitter", "linkedin"], preview: "I'm doing an AMA! 🎤 Ask me anything about [topic/industry/journey]. Drop your questions in the comments and I'll answer every single one. Nothing is off limits!", tags: ["ama", "community"] },
  { id: 18, title: "Weekend Check-In", category: "Engagement", icon: "🌅", platforms: ["instagram", "facebook"], preview: "Happy [day]! 🌞 What's everyone up to this weekend? We're [what your brand is doing]. Share your plans below — we love hearing from our community! 💬", tags: ["casual", "weekend"] },
  { id: 19, title: "Throwback", category: "Engagement", icon: "⏪", platforms: ["instagram", "facebook", "tiktok"], preview: "#TBT to when [throwback memory]. How far we've come! 😊 Swipe to see then vs. now. What's your favorite memory from our early days? Tell us below 👇", tags: ["throwback", "nostalgia"] },
  { id: 20, title: "Fan Spotlight", category: "Engagement", icon: "⭐", platforms: ["instagram", "facebook"], preview: "✨ Customer Spotlight! Meet [Customer Name], who used [Product] to achieve [result]. We love seeing our community thrive. Share YOUR story with us using [hashtag]!", tags: ["community", "spotlight"] },

  // ── Educational & How-To (10) ──
  { id: 21, title: "5 Quick Tips", category: "Educational", icon: "💡", platforms: ["instagram", "linkedin", "facebook"], preview: "5 tips to [achieve goal] that nobody talks about:\n1️⃣ [Tip 1]\n2️⃣ [Tip 2]\n3️⃣ [Tip 3]\n4️⃣ [Tip 4]\n5️⃣ [Tip 5]\nSave this post — you'll need it! 🔖", tags: ["tips", "listicle"] },
  { id: 22, title: "Step-by-Step Tutorial", category: "Educational", icon: "📚", platforms: ["instagram", "tiktok", "linkedin"], preview: "How to [achieve result] in [timeframe]:\nStep 1: [action]\nStep 2: [action]\nStep 3: [action]\nStep 4: [action]\nTry this today and let me know how it goes! 💪", tags: ["tutorial", "howto"] },
  { id: 23, title: "Myth Buster", category: "Educational", icon: "🚫", platforms: ["linkedin", "twitter", "instagram"], preview: "🚨 Let's bust a [industry] myth: '[Common misconception].' The truth? [Actual truth]. Here's why this matters for your business — and what to do instead...", tags: ["myth", "education"] },
  { id: 24, title: "Did You Know?", category: "Educational", icon: "🤓", platforms: ["instagram", "twitter", "facebook"], preview: "Did you know? 🤔 [Surprising fact about your industry]. Most people don't realize this, but it can make a huge difference in [outcome]. Here's how to use this insight...", tags: ["facts", "trivia"] },
  { id: 25, title: "Common Mistakes", category: "Educational", icon: "⚠️", platforms: ["linkedin", "instagram", "facebook"], preview: "❌ 5 mistakes [target audience] make with [topic]:\n1. [Mistake 1]\n2. [Mistake 2]\n3. [Mistake 3]\n4. [Mistake 4]\n5. [Mistake 5]\nAre you guilty of any of these? 👇", tags: ["mistakes", "advice"] },
  { id: 26, title: "Glossary / Definition", category: "Educational", icon: "📖", platforms: ["linkedin", "twitter", "instagram"], preview: "📖 [Industry Term] Explained:\nWhat it is: [Definition]\nWhy it matters: [Importance]\nHow to use it: [Practical application]\nBookmark this for your team! 🔖", tags: ["glossary", "education"] },
  { id: 27, title: "Tools & Resources", category: "Educational", icon: "🛠️", platforms: ["linkedin", "twitter", "instagram"], preview: "My top [X] tools for [goal] that I use every single day:\n🔧 [Tool 1] — [what it does]\n🔧 [Tool 2] — [what it does]\n🔧 [Tool 3] — [what it does]\nAll linked in bio!", tags: ["tools", "resources"] },
  { id: 28, title: "Stats Roundup", category: "Educational", icon: "📊", platforms: ["linkedin", "twitter", "instagram"], preview: "📊 [Industry] by the numbers in [year]:\n→ [Stat 1]\n→ [Stat 2]\n→ [Stat 3]\n→ [Stat 4]\nWhat does this mean for your business? Let's break it down...", tags: ["stats", "data"] },
  { id: 29, title: "Beginner's Guide", category: "Educational", icon: "🎯", platforms: ["linkedin", "instagram", "facebook"], preview: "NEW TO [topic]? Here's everything you need to know to get started:\n✅ [Point 1]\n✅ [Point 2]\n✅ [Point 3]\n✅ [Point 4]\nSave & share this with a friend starting out!", tags: ["beginner", "guide"] },
  { id: 30, title: "Trend Alert", category: "Educational", icon: "📈", platforms: ["linkedin", "twitter", "instagram"], preview: "🔥 The [industry] trend you NEED to know about right now: [Trend name]. Here's why it's changing everything and exactly how to get ahead of it before everyone else does.", tags: ["trends", "industry"] },

  // ── Social Proof (6) ──
  { id: 31, title: "Customer Success Story", category: "Social Proof", icon: "🏆", platforms: ["linkedin", "facebook", "instagram"], preview: "\"[Product] completely changed how we [do something].\" — [Customer Name], [Title] at [Company]. Since using [Product], they've seen [specific results]. Here's their full story...", tags: ["testimonial", "success"] },
  { id: 32, title: "Results Showcase", category: "Social Proof", icon: "📊", platforms: ["instagram", "linkedin", "facebook"], preview: "Real results from real customers:\n🎯 [Customer 1]: [Result 1]\n🎯 [Customer 2]: [Result 2]\n🎯 [Customer 3]: [Result 3]\nYour results could be next. DM us to get started!", tags: ["results", "proof"] },
  { id: 33, title: "Press Mention", category: "Social Proof", icon: "📰", platforms: ["linkedin", "twitter", "instagram"], preview: "We're honored to be featured in [Publication]! 🗞️ [Quote from article or key highlight]. Read the full story at the link in our bio. Thank you [Publication] for the spotlight!", tags: ["press", "media"] },
  { id: 34, title: "Award Win", category: "Social Proof", icon: "🥇", platforms: ["linkedin", "instagram", "twitter"], preview: "We're thrilled to announce that [Company] has been recognized as [Award Name] by [Organization]! 🏆 This belongs to our incredible team and loyal customers. Thank you! 🙏", tags: ["award", "recognition"] },
  { id: 35, title: "User-Generated Content", category: "Social Proof", icon: "📸", platforms: ["instagram", "facebook", "tiktok"], preview: "Look at this amazing shot from @[username] using our [product]! 😍 This is exactly why we do what we do. Tag us in your photos for a chance to be featured! ❤️", tags: ["ugc", "community"] },
  { id: 36, title: "5-Star Review", category: "Social Proof", icon: "⭐", platforms: ["instagram", "facebook", "linkedin"], preview: "⭐⭐⭐⭐⭐\n\"[Review text]\"\n— [Reviewer Name] on [Platform]\n\nReviews like this are why we pour everything into [what you do]. Thank you from the bottom of our hearts! 🙏", tags: ["review", "testimonial"] },

  // ── Behind the Scenes (6) ──
  { id: 37, title: "Day in the Life", category: "Behind the Scenes", icon: "📅", platforms: ["instagram", "tiktok", "linkedin"], preview: "A day in the life at [Company] 👀\n6am: [activity]\n9am: [activity]\n12pm: [activity]\n3pm: [activity]\n6pm: [reflection]\nWhat does YOUR workday look like? 👇", tags: ["bts", "culture"] },
  { id: 38, title: "Meet the Team", category: "Behind the Scenes", icon: "👋", platforms: ["instagram", "linkedin", "facebook"], preview: "Meet [Name], our [Title]! 👋 [Fun fact about them]. When they're not [work activity], you'll find them [hobby]. We're so lucky to have [Name] on the team! Say hello 👇", tags: ["team", "culture"] },
  { id: 39, title: "Office / Workspace Tour", category: "Behind the Scenes", icon: "🏢", platforms: ["instagram", "tiktok", "linkedin"], preview: "Ever wondered what our workspace looks like? 🏢 Take the full tour! P.S. — The [fun detail] is everyone's favorite spot. Can you spot it in the photos? 🔍", tags: ["office", "workspace"] },
  { id: 40, title: "How It's Made", category: "Behind the Scenes", icon: "🔨", platforms: ["instagram", "tiktok", "youtube"], preview: "Ever wondered how [product/service] gets made? 🤔 Here's a look at everything that goes into each [product] before it reaches you. Spoiler: there's a LOT of love involved! ❤️", tags: ["process", "making"] },
  { id: 41, title: "Company Values", category: "Behind the Scenes", icon: "❤️", platforms: ["instagram", "linkedin", "facebook"], preview: "Culture isn't what you say — it's what you do. At [Company], we live by [value 1], [value 2], and [value 3]. Here's what that looks like in practice every single day...", tags: ["culture", "values"] },
  { id: 42, title: "Workspace Setup", category: "Behind the Scenes", icon: "💻", platforms: ["instagram", "twitter", "linkedin"], preview: "Setup reveal! 🖥️ This is where the magic happens. My daily must-haves: [item 1], [item 2], [item 3]. What does your workspace look like? Show us below! 👇", tags: ["workspace", "setup"] },

  // ── Events & Announcements (6) ──
  { id: 43, title: "Webinar Invite", category: "Events", icon: "🎤", platforms: ["linkedin", "facebook", "twitter"], preview: "Join us LIVE on [date] for our FREE webinar: '[Topic]'. In 60 minutes you'll learn:\n✅ [Point 1]\n✅ [Point 2]\n✅ [Point 3]\nRegister now — seats are limited! 🔗 Link in bio.", tags: ["webinar", "event"] },
  { id: 44, title: "Conference Appearance", category: "Events", icon: "🏛️", platforms: ["linkedin", "twitter", "instagram"], preview: "We're heading to [Event Name] in [City]! 🗺️ Come find us at booth [#] — we'll be showcasing [product/service] and would LOVE to connect. Drop a comment if you'll be there!", tags: ["conference", "networking"] },
  { id: 45, title: "Going Live", category: "Events", icon: "📺", platforms: ["instagram", "twitter", "youtube"], preview: "Going LIVE on [date] at [time]! 🎥 I'll be covering [topic], answering your questions, and giving away [prize] to a lucky live viewer. Set your reminder — don't miss it!", tags: ["live", "stream"] },
  { id: 46, title: "Product Demo Day", category: "Events", icon: "🔍", platforms: ["linkedin", "facebook", "youtube"], preview: "Curious about [Product]? Join our live demo on [date] at [time]! See exactly how it works, ask questions in real time, and get [exclusive offer] just for attending. 🎁", tags: ["demo", "product"] },
  { id: 47, title: "Workshop Alert", category: "Events", icon: "✏️", platforms: ["instagram", "linkedin", "facebook"], preview: "📣 WORKSHOP ALERT! We're hosting a hands-on [topic] workshop on [date]. Perfect for [target audience]. You'll leave with [outcome 1] and [outcome 2]. Seats are extremely limited!", tags: ["workshop", "education"] },
  { id: 48, title: "Holiday Wishes", category: "Events", icon: "🎄", platforms: ["instagram", "facebook", "twitter"], preview: "Happy [Holiday] from all of us at [Company]! 🎊 As you celebrate and reflect, we're grateful for every customer, partner, and team member who made this year extraordinary. ❤️", tags: ["holiday", "seasonal"] },

  // ── Inspirational (6) ──
  { id: 49, title: "Founder Story", category: "Inspirational", icon: "🌱", platforms: ["linkedin", "instagram", "facebook"], preview: "[X] years ago, I started [Company] with [nothing/just an idea/$X]. People told me [doubt]. Here's what the journey to [achievement] actually looked like — the good, bad, and ugly.", tags: ["founder", "story"] },
  { id: 50, title: "Monday Motivation", category: "Inspirational", icon: "💪", platforms: ["instagram", "twitter", "linkedin"], preview: "Monday mindset: [Motivational message]. The week ahead is full of possibilities. Here's what WE are focused on this week — what about you? Share below 👇 #MondayMotivation", tags: ["monday", "motivation"] },
  { id: 51, title: "Lessons from Failure", category: "Inspirational", icon: "🔄", platforms: ["linkedin", "instagram", "twitter"], preview: "I failed [number] times before things clicked. Here's what those failures taught me about [topic]:\n\n[Lesson 1]\n[Lesson 2]\n[Lesson 3]\n\nFailure isn't the opposite of success — it's part of it.", tags: ["failure", "lessons"] },
  { id: 52, title: "Quote of the Week", category: "Inspirational", icon: "💬", platforms: ["instagram", "twitter", "facebook"], preview: "\"[Powerful quote related to your industry.]\"\n— [Author]\n\nThis hits differently every time I read it. What quote has had the biggest impact on how you think? 👇", tags: ["quote", "inspiration"] },
  { id: 53, title: "Gratitude Post", category: "Inspirational", icon: "🙏", platforms: ["instagram", "linkedin", "facebook"], preview: "Grateful moment 🙏 [Milestone/moment]. Couldn't have reached this without [team/customers/community]. A heartfelt thank you to everyone who has been part of this journey. ❤️", tags: ["gratitude", "appreciation"] },
  { id: 54, title: "Year in Review", category: "Inspirational", icon: "📆", platforms: ["linkedin", "instagram", "facebook"], preview: "What a year! Reflecting on [Year]:\n🚀 [Achievement 1]\n💡 [Achievement 2]\n🤝 [Achievement 3]\n❤️ [Achievement 4]\nThank you for being part of every moment. On to [next year]! 🥂", tags: ["review", "yearly"] },

  // ── Humor & Entertainment (6) ──
  { id: 55, title: "Relatable Moment", category: "Humor", icon: "😂", platforms: ["instagram", "twitter", "tiktok"], preview: "Us on [day before]: 'This week is going to be SO productive!' Also us: [relatable outcome]. Every. Single. Time. 😅 Tag someone who gets this on a spiritual level.", tags: ["meme", "relatable"] },
  { id: 56, title: "Hot Take", category: "Humor", icon: "🔥", platforms: ["twitter", "linkedin", "instagram"], preview: "Hot take: [Slightly controversial but safe opinion about your industry]. There, I said it. 🔥 Agree or disagree? I'm ready for the comments. Bring it. 👇", tags: ["hottake", "debate"] },
  { id: 57, title: "Honest Confession", category: "Humor", icon: "😅", platforms: ["instagram", "tiktok", "twitter"], preview: "Being real for a second: [Funny/relatable admission about running a business or your industry]. Anyone else? No? Just me? Cool. 😂 #entrepreneurlife #realtalk", tags: ["honest", "relatable"] },
  { id: 58, title: "Expectation vs Reality", category: "Humor", icon: "🤣", platforms: ["instagram", "tiktok", "facebook"], preview: "Expectation: [What people think your job/product is like] 😇\nReality: [The hilarious truth] 😂\n\nTag someone who NEEDS to see this. #relatable #[industry]life", tags: ["expectation", "reality"] },
  { id: 59, title: "POV Post", category: "Humor", icon: "🎭", platforms: ["tiktok", "instagram", "twitter"], preview: "POV: You're [target customer] and you just discovered [product/solution] for the first time 🤯 [Describe the dramatic, relatable reaction]. This is the content we needed today.", tags: ["pov", "humor"] },
  { id: 60, title: "Team Shenanigans", category: "Humor", icon: "🎪", platforms: ["instagram", "tiktok", "facebook"], preview: "We told ourselves we'd be professional this week. [Description of what actually happened]. Still working on it. 😂 This is what building an amazing culture ACTUALLY looks like.", tags: ["team", "fun"] },

  // ── Industry & Thought Leadership (6) ──
  { id: 61, title: "Industry Prediction", category: "Thought Leadership", icon: "🔮", platforms: ["linkedin", "twitter", "instagram"], preview: "Prediction: In the next [timeframe], [industry] will see [major shift]. Here's why I believe this is inevitable — and exactly how forward-thinking companies should be positioning now.", tags: ["prediction", "leadership"] },
  { id: 62, title: "Contrarian View", category: "Thought Leadership", icon: "🧠", platforms: ["linkedin", "twitter"], preview: "Everyone in [industry] is focused on [popular thing]. I think they're missing the bigger picture. Here's the unpopular truth about what actually drives [result]...", tags: ["contrarian", "thought"] },
  { id: 63, title: "Industry Report Insight", category: "Thought Leadership", icon: "📑", platforms: ["linkedin", "twitter", "instagram"], preview: "Just read [Report Name] by [Organization]. The most surprising finding? [Key insight]. Here's what this means for [industry professionals] and how to act on it today...", tags: ["research", "insight"] },
  { id: 64, title: "My Framework", category: "Thought Leadership", icon: "🗂️", platforms: ["linkedin", "instagram", "twitter"], preview: "The [Name] Framework — how I approach [challenge] every time:\n\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n4. [Step 4]\n\nStole this idea from no one. Happy to share it with everyone.", tags: ["framework", "strategy"] },
  { id: 65, title: "Open Letter", category: "Thought Leadership", icon: "✉️", platforms: ["linkedin", "facebook"], preview: "An open letter to [target audience]: [Empathetic opening acknowledging their struggle]. You're not alone. And here's what I wish someone had told me when I was in your position...", tags: ["letter", "empathy"] },
  { id: 66, title: "Lessons Learned", category: "Thought Leadership", icon: "📋", platforms: ["linkedin", "instagram", "twitter"], preview: "After [X years / X clients / X projects] in [industry], here are the [X] lessons I wish I knew at the start:\n\n[Lesson 1]\n[Lesson 2]\n[Lesson 3]\n\nSave this for when you need it most.", tags: ["lessons", "experience"] },
];

// ── Nav & types ────────────────────────────────────────────────────────────────

type View = "dashboard" | "create" | "calendar" | "templates" | "brand-voice" | "analytics";

const NAV_ITEMS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "create", label: "Create Content", icon: PenLine },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "templates", label: "Templates", icon: FileText },
  { id: "brand-voice", label: "Brand Voice", icon: Megaphone },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
];

// ── Calendar helpers ───────────────────────────────────────────────────────────

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_RECENT = [
  { id: 1, platform: "instagram", preview: "Exciting day at the office! We just hit a major milestone 🎉 #startup #growth", time: "2h ago", likes: 142, comments: 18 },
  { id: 2, platform: "linkedin", preview: "Proud to announce that our team has grown by 40% this quarter. Here's what we learned about scaling...", time: "1d ago", likes: 87, comments: 24 },
  { id: 3, platform: "twitter", preview: "The best time to start was yesterday. The second best time is now. 🚀 #entrepreneurship", time: "2d ago", likes: 203, comments: 11 },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SocialMediaManager() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<View>("dashboard");

  // Create Content state
  const [topic, setTopic] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "twitter", "linkedin"]);
  const [tone, setTone] = useState("Professional");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmoji, setIncludeEmoji] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [activePlatformPreview, setActivePlatformPreview] = useState("instagram");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Image generation state
  const [imageStyle, setImageStyle] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [generatedImageContentType, setGeneratedImageContentType] = useState("image/jpeg");
  const [showImageSection, setShowImageSection] = useState(false);

  // Brand Voice state
  const [brandName, setBrandName] = useState(() => localStorage.getItem("smm_brand_name") || "");
  const [brandDesc, setBrandDesc] = useState(() => localStorage.getItem("smm_brand_desc") || "");
  const [brandTone, setBrandTone] = useState(() => localStorage.getItem("smm_brand_tone") || "Professional");
  const [brandKeywords, setBrandKeywords] = useState(() => localStorage.getItem("smm_brand_keywords") || "");
  const [brandAvoid, setBrandAvoid] = useState(() => localStorage.getItem("smm_brand_avoid") || "");
  const [brandSaved, setBrandSaved] = useState(false);

  // Calendar state
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [scheduledPosts, setScheduledPosts] = useState<{ date: string; platform: string; preview: string }[]>([
    { date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate() + 2).padStart(2, "0")}`, platform: "instagram", preview: "New product launch 🚀" },
    { date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate() + 5).padStart(2, "0")}`, platform: "linkedin", preview: "Team milestone update" },
    { date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate() + 7).padStart(2, "0")}`, platform: "twitter", preview: "Quick tip 💡" },
  ]);

  // Template filter
  const [templateCategory, setTemplateCategory] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const categories = ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((p) => p !== id) : prev) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { toast({ title: "Topic required", description: "Tell us what your post is about.", variant: "destructive" }); return; }
    setGenerating(true);
    setGeneratedContent({});
    try {
      const result = await generateSocialContent({ topic, platforms: selectedPlatforms, tone, brand_name: brandName, brand_description: brandDesc, include_hashtags: includeHashtags, include_emoji: includeEmoji });
      setGeneratedContent(result.platforms);
      setActivePlatformPreview(selectedPlatforms[0]);
      toast({ title: "Content generated!", description: `Created posts for ${selectedPlatforms.length} platform(s).` });
    } catch {
      toast({ title: "Generation failed", description: "Could not generate content. Please try again.", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleGenerateImage = async () => {
    if (!topic.trim() && !imagePrompt.trim()) { toast({ title: "Describe your image", description: "Tell us what you want to create.", variant: "destructive" }); return; }
    setGeneratingImage(true);
    setGeneratedImageBase64(null);
    const model = STYLE_MODEL_MAP[imageStyle] || "flux-schnell";
    try {
      const result = await generateSocialImage({ topic: imagePrompt || topic, model, style: imageStyle, aspect_ratio: aspectRatio, platform: activePlatformPreview });
      setGeneratedImageBase64(result.image_base64);
      setGeneratedImageContentType(result.content_type || "image/jpeg");
      toast({ title: "Image ready!", description: "Your AI image has been generated." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Image generation failed.";
      toast({ title: "Image failed", description: msg, variant: "destructive" });
    } finally { setGeneratingImage(false); }
  };

  const handleCopy = (platformId: string) => {
    const text = generatedContent[platformId];
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(platformId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied!", description: "Content copied to clipboard." });
  };

  const handleEdit = (platformId: string) => { setEditingPlatform(platformId); setEditText(generatedContent[platformId] || ""); };
  const handleSaveEdit = () => { if (!editingPlatform) return; setGeneratedContent((prev) => ({ ...prev, [editingPlatform]: editText })); setEditingPlatform(null); };

  const handleSchedule = (platformId: string) => {
    const preview = generatedContent[platformId];
    if (!preview) return;
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(today.getDate() + 3).padStart(2, "0")}`;
    setScheduledPosts((prev) => [...prev, { date: dateStr, platform: platformId, preview: preview.slice(0, 60) }]);
    toast({ title: "Scheduled!", description: "Post added to your content calendar." });
  };

  const handleSaveBrandVoice = () => {
    localStorage.setItem("smm_brand_name", brandName);
    localStorage.setItem("smm_brand_desc", brandDesc);
    localStorage.setItem("smm_brand_tone", brandTone);
    localStorage.setItem("smm_brand_keywords", brandKeywords);
    localStorage.setItem("smm_brand_avoid", brandAvoid);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
    toast({ title: "Brand Voice saved!", description: "Applied to all future generations." });
  };

  const useTemplate = (template: (typeof TEMPLATES)[0]) => {
    setTopic(template.preview);
    setSelectedPlatforms(template.platforms);
    setView("create");
  };

  const getPlatform = (id: string) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];

  const calDays = getDaysInMonth(calYear, calMonth);
  const calFirstDay = getFirstDayOfMonth(calYear, calMonth);
  const calKey = (day: number) => `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const postsOnDay = (day: number) => scheduledPosts.filter((p) => p.date === calKey(day));
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); };

  const filteredTemplates = TEMPLATES.filter((t) =>
    (templateCategory === "All" || t.category === templateCategory) &&
    (!templateSearch || t.title.toLowerCase().includes(templateSearch.toLowerCase()) || t.tags.some((tag) => tag.includes(templateSearch.toLowerCase())))
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar ── */}
      <aside className="w-56 lg:w-64 shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-xl h-screen sticky top-0 z-40 flex flex-col">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-border/30">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors mr-1">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm gradient-text">Social Media</span>
          </div>
        </div>
        {brandName && (
          <div className="mx-3 mt-4 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">Brand</p>
            <p className="text-sm font-semibold truncate">{brandName}</p>
          </div>
        )}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200", view === item.id ? "bg-primary/10 text-primary border border-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50")}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border/30">
          <Button className="w-full gap-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 text-white border-0" size="sm" onClick={() => setView("create")}>
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════ DASHBOARD ══════════════════════════ */}
          {view === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-6 lg:p-8 space-y-8">
              <div>
                <h1 className="text-2xl font-bold">Social Media Manager</h1>
                <p className="text-muted-foreground mt-1">AI-powered content creation for every platform.</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Posts Generated", value: "47", icon: Sparkles, color: "text-violet-400", bg: "bg-violet-400/10" },
                  { label: "Scheduled", value: String(scheduledPosts.length), icon: Clock, color: "text-blue-400", bg: "bg-blue-400/10" },
                  { label: "Published", value: "23", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
                  { label: "Engagement Rate", value: "6.4%", icon: TrendingUp, color: "text-pink-400", bg: "bg-pink-400/10" },
                ].map((stat) => (
                  <Card key={stat.label} className="border-border/30 bg-card/50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
                        <stat.icon className={cn("h-5 w-5", stat.color)} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div>
                <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Create Post", desc: "Generate AI content for any platform", icon: Sparkles, view: "create" as View, gradient: "from-violet-500 to-pink-500" },
                    { label: "View Calendar", desc: "Manage your scheduled content", icon: CalendarDays, view: "calendar" as View, gradient: "from-blue-500 to-cyan-500" },
                    { label: "Set Brand Voice", desc: "Customize your tone and style", icon: Megaphone, view: "brand-voice" as View, gradient: "from-orange-500 to-amber-500" },
                  ].map((action) => (
                    <button key={action.label} onClick={() => setView(action.view)} className="text-left p-4 rounded-2xl border border-border/30 bg-card/50 hover:bg-card/80 transition-all group">
                      <div className={cn("h-9 w-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3", action.gradient)}>
                        <action.icon className="h-4 w-4 text-white" />
                      </div>
                      <p className="font-semibold text-sm">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Recent Posts</h2>
                  <Button variant="ghost" size="sm" onClick={() => setView("create")}><Plus className="h-3.5 w-3.5 mr-1" /> New</Button>
                </div>
                <div className="space-y-3">
                  {MOCK_RECENT.map((post) => {
                    const plat = getPlatform(post.platform);
                    return (
                      <div key={post.id} className="flex items-start gap-3 p-4 rounded-2xl border border-border/30 bg-card/50">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0", plat.gradient)}>{plat.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{post.preview}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-muted-foreground">{post.time}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="h-3 w-3" />{post.likes}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="h-3 w-3" />{post.comments}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════ CREATE CONTENT ══════════════════════════ */}
          {view === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="flex h-screen overflow-hidden">
              {/* Left: Input panel */}
              <div className="w-[420px] lg:w-[460px] shrink-0 border-r border-border/30 h-full overflow-y-auto flex flex-col">
                <div className="p-5 border-b border-border/30">
                  <h2 className="font-bold text-lg">Create Content</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Describe your topic and let AI do the rest.</p>
                </div>
                <div className="p-5 space-y-5 flex-1">
                  {/* Topic */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">What's your post about?</Label>
                    <Textarea placeholder="e.g. We just launched a new AI feature that helps businesses save 10 hours per week on customer support..." value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} className="resize-none bg-card/50 border-border/40 focus:border-primary/50 text-sm" />
                    <p className="text-xs text-muted-foreground text-right">{topic.length} chars</p>
                  </div>
                  {/* Platforms */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Platforms</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <button key={p.id} onClick={() => togglePlatform(p.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all", selectedPlatforms.includes(p.id) ? cn("text-white border-transparent bg-gradient-to-r", p.gradient) : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                          <span className="text-[10px]">{p.emoji}</span>{p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Tone */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tone</Label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button key={t} onClick={() => setTone(t)} className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all", tone === t ? "bg-primary/10 text-primary border-primary/30" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Options */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Options</Label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" /><Label htmlFor="hashtags" className="text-sm cursor-pointer">Include hashtags</Label></div>
                      <Switch id="hashtags" checked={includeHashtags} onCheckedChange={setIncludeHashtags} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="text-sm">😊</span><Label htmlFor="emoji" className="text-sm cursor-pointer">Include emoji</Label></div>
                      <Switch id="emoji" checked={includeEmoji} onCheckedChange={setIncludeEmoji} />
                    </div>
                  </div>
                  {brandName && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                      <Megaphone className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs text-primary">Using <strong>{brandName}</strong> brand voice</p>
                    </div>
                  )}

                  {/* ── AI Image section ── */}
                  <div className="rounded-2xl border border-border/30 overflow-hidden">
                    <button onClick={() => setShowImageSection((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                          <Image className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold">AI Image Generator</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Powered by FLUX</Badge>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", showImageSection && "rotate-90")} />
                    </button>
                    {showImageSection && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/20">
                        <div className="space-y-2 pt-3">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Image Prompt (optional)</Label>
                          <Input placeholder="e.g. A modern office team celebrating a win..." value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} className="text-sm bg-card/50 border-border/40" />
                          <p className="text-[11px] text-muted-foreground">Leave blank to auto-generate from your topic.</p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Style</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {IMAGE_STYLES.map((s) => (
                              <button key={s.id} onClick={() => setImageStyle(s.id)} className={cn("flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left", imageStyle === s.id ? "bg-primary/10 text-primary border-primary/30" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                                <span>{s.emoji}</span>{s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aspect Ratio</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {ASPECT_RATIOS.map((r) => (
                              <button key={r.id} onClick={() => setAspectRatio(r.id)} className={cn("px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left", aspectRatio === r.id ? "bg-primary/10 text-primary border-primary/30" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                                <span className="block font-semibold">{r.label}</span>
                                <span className="text-[10px] opacity-70">{r.hint}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button onClick={handleGenerateImage} disabled={generatingImage} className="w-full gap-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 text-white border-0" size="sm">
                          {generatingImage ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Generating image...</> : <><Image className="h-3.5 w-3.5" />Generate Image</>}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Generate button */}
                <div className="p-5 border-t border-border/30">
                  <Button onClick={handleGenerate} disabled={generating || !topic.trim()} className="w-full gap-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 text-white border-0 h-11">
                    {generating ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4" />Generate Content</>}
                  </Button>
                </div>
              </div>

              {/* Right: Preview panel */}
              <div className="flex-1 h-full overflow-y-auto bg-muted/20">
                {Object.keys(generatedContent).length === 0 && !generatedImageBase64 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-8">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-violet-400" />
                    </div>
                    <h3 className="font-semibold text-lg">Ready to create</h3>
                    <p className="text-muted-foreground text-sm mt-2 max-w-xs">Describe your topic, pick platforms and tone, then hit Generate. Add an AI image to make it pop.</p>
                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                      {["Product launch", "Company milestone", "Weekly tip", "Customer success story", "Hiring announcement", "Behind the scenes"].map((s) => (
                        <button key={s} onClick={() => setTopic(s)} className="px-3 py-1.5 rounded-full border border-border/40 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">{s}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                    {/* Generated image */}
                    {generatedImageBase64 && (
                      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Image className="h-4 w-4 text-violet-400" />AI Generated Image
                          </Label>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { const w = window.open(); if (w) { w.document.write(`<img src="data:${generatedImageContentType};base64,${generatedImageBase64}" style="max-width:100%">`); } }}>
                              <ZoomIn className="h-3.5 w-3.5" />View Full
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { const a = document.createElement("a"); a.href = `data:${generatedImageContentType};base64,${generatedImageBase64}`; a.download = "social-image.png"; a.click(); }}>
                              <Download className="h-3.5 w-3.5" />Download
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-2xl overflow-hidden border border-border/30">
                          <img src={`data:${generatedImageContentType};base64,${generatedImageBase64}`} alt="AI generated social media image" className="w-full object-cover" />
                        </div>
                        <Button size="sm" variant="outline" onClick={handleGenerateImage} disabled={generatingImage} className="gap-2 text-xs">
                          <RefreshCw className={cn("h-3.5 w-3.5", generatingImage && "animate-spin")} />Regenerate Image
                        </Button>
                      </motion.div>
                    )}

                    {/* Platform tabs */}
                    {Object.keys(generatedContent).length > 0 && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {selectedPlatforms.filter((id) => generatedContent[id]).map((id) => {
                            const plat = getPlatform(id);
                            return (
                              <button key={id} onClick={() => setActivePlatformPreview(id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all", activePlatformPreview === id ? cn("text-white border-transparent bg-gradient-to-r", plat.gradient) : "border-border/40 text-muted-foreground hover:border-border")}>
                                <span className="text-[10px]">{plat.emoji}</span>{plat.label}
                              </button>
                            );
                          })}
                        </div>

                        {selectedPlatforms.filter((id) => generatedContent[id]).map((id) => {
                          const plat = getPlatform(id);
                          const content = generatedContent[id];
                          const charPct = Math.min(100, (content.length / plat.charLimit) * 100);
                          return (
                            <AnimatePresence key={id}>
                              {activePlatformPreview === id && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                                  {/* Platform mockup */}
                                  <div className={cn("rounded-2xl border p-5", plat.border, plat.mockupBg)}>
                                    <div className="flex items-center gap-2 mb-4">
                                      <div className={cn("h-8 w-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white", plat.gradient)}>{plat.emoji}</div>
                                      <div>
                                        <p className="text-xs font-semibold">{brandName || "Your Account"}</p>
                                        <p className="text-[10px] text-muted-foreground">Just now</p>
                                      </div>
                                    </div>
                                    {generatedImageBase64 && <img src={`data:${generatedImageContentType};base64,${generatedImageBase64}`} alt="post" className="w-full rounded-xl mb-4 object-cover max-h-48" />}
                                    {editingPlatform === id ? (
                                      <div className="space-y-2">
                                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={8} className="text-sm bg-background/50 border-border/40 resize-none" />
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={handleSaveEdit} className="gap-1"><Check className="h-3.5 w-3.5" />Save</Button>
                                          <Button size="sm" variant="outline" onClick={() => setEditingPlatform(null)}>Cancel</Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/20">
                                      {plat.engagementIcons.map((Icon, i) => (
                                        <button key={i} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                          <Icon className="h-4 w-4" /><span className="text-xs">{Math.floor(Math.random() * 50 + 5)}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  {/* Char count */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>{content.length} characters</span>
                                      <span>Limit: {plat.charLimit.toLocaleString()}</span>
                                    </div>
                                    <Progress value={charPct} className="h-1.5" />
                                  </div>
                                  {/* Actions */}
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleCopy(id)} className="gap-2">
                                      {copiedId === id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                      {copiedId === id ? "Copied!" : "Copy"}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => handleEdit(id)} className="gap-2"><Edit3 className="h-3.5 w-3.5" />Edit</Button>
                                    <Button size="sm" variant="outline" onClick={() => handleSchedule(id)} className="gap-2"><CalendarDays className="h-3.5 w-3.5" />Schedule</Button>
                                    <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2"><RefreshCw className={cn("h-3.5 w-3.5", generating && "animate-spin")} />Regenerate</Button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════ CALENDAR ══════════════════════════ */}
          {view === "calendar" && (
            <motion.div key="calendar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-6 lg:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-bold">Content Calendar</h2><p className="text-muted-foreground text-sm mt-1">Manage your scheduled posts.</p></div>
                <Button onClick={() => setView("create")} className="gap-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white border-0"><Plus className="h-4 w-4" />Create Post</Button>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-secondary/50 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <h3 className="text-lg font-semibold w-44 text-center">{MONTH_NAMES[calMonth]} {calYear}</h3>
                <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-secondary/50 transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="rounded-2xl border border-border/30 overflow-hidden bg-card/30">
                <div className="grid grid-cols-7 border-b border-border/30">
                  {DAY_NAMES.map((d) => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-3">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: calFirstDay }).map((_, i) => <div key={`e${i}`} className="min-h-[90px] border-r border-b border-border/20 bg-muted/10" />)}
                  {Array.from({ length: calDays }).map((_, idx) => {
                    const day = idx + 1;
                    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const posts = postsOnDay(day);
                    return (
                      <div key={day} className={cn("min-h-[90px] border-r border-b border-border/20 p-2 hover:bg-secondary/20 cursor-pointer transition-colors", isToday && "bg-primary/5")}>
                        <span className={cn("text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full", isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{day}</span>
                        <div className="mt-1 space-y-1">
                          {posts.map((post, i) => {
                            const plat = getPlatform(post.platform);
                            return <div key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded-md text-white truncate bg-gradient-to-r", plat.gradient)} title={post.preview}>{plat.emoji} {post.preview}</div>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {scheduledPosts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Upcoming Posts</h3>
                  <div className="space-y-2">
                    {scheduledPosts.map((post, i) => {
                      const plat = getPlatform(post.platform);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0", plat.gradient)}>{plat.emoji}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium text-muted-foreground">{post.date}</p><p className="text-sm truncate">{post.preview}</p></div>
                          <button onClick={() => setScheduledPosts((prev) => prev.filter((_, idx) => idx !== i))} className="p-1 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════ TEMPLATES ══════════════════════════ */}
          {view === "templates" && (
            <motion.div key="templates" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-6 lg:p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Templates</h2>
                <p className="text-muted-foreground text-sm mt-1">{TEMPLATES.length} templates across {categories.length - 1} categories. Start fast, customize with AI.</p>
              </div>
              {/* Search + filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Input placeholder="Search templates..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} className="bg-card/50 border-border/40 max-w-xs" />
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button key={cat} onClick={() => setTemplateCategory(cat)} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", templateCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{filteredTemplates.length} templates</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="border-border/30 bg-card/50 hover:bg-card/80 transition-all group flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <span className="text-lg mt-0.5">{template.icon}</span>
                          <div>
                            <CardTitle className="text-sm">{template.title}</CardTitle>
                            <Badge variant="secondary" className="mt-1 text-[10px]">{template.category}</Badge>
                          </div>
                        </div>
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1 flex flex-col">
                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">{template.preview}</p>
                      <div className="flex flex-wrap gap-1">
                        {template.platforms.map((id) => {
                          const plat = getPlatform(id);
                          return <span key={id} className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", plat.text, plat.border, plat.bg)}>{plat.emoji} {plat.label}</span>;
                        })}
                      </div>
                      <Button size="sm" className="w-full gap-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white border-0 mt-auto" onClick={() => useTemplate(template)}>
                        <Wand2 className="h-3.5 w-3.5" />Use Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════ BRAND VOICE ══════════════════════════ */}
          {view === "brand-voice" && (
            <motion.div key="brand-voice" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-6 lg:p-8 max-w-2xl space-y-6">
              <div><h2 className="text-2xl font-bold">Brand Voice</h2><p className="text-muted-foreground text-sm mt-1">Configure your brand identity. Applied to every post you generate.</p></div>
              <div className="space-y-5">
                <div className="space-y-2"><Label className="font-semibold">Brand / Company Name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Acme Inc." className="bg-card/50 border-border/40" /></div>
                <div className="space-y-2"><Label className="font-semibold">Brand Description</Label><Textarea value={brandDesc} onChange={(e) => setBrandDesc(e.target.value)} placeholder="e.g. We build AI-powered tools for small businesses to automate customer support and grow faster." rows={4} className="bg-card/50 border-border/40 resize-none" /></div>
                <div className="space-y-2">
                  <Label className="font-semibold">Default Tone</Label>
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => (<button key={t} onClick={() => setBrandTone(t)} className={cn("px-3 py-1.5 rounded-xl text-sm font-medium border transition-all", brandTone === t ? "bg-primary/10 text-primary border-primary/30" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>{t}</button>))}
                  </div>
                </div>
                <div className="space-y-2"><Label className="font-semibold">Keywords to Include</Label><Input value={brandKeywords} onChange={(e) => setBrandKeywords(e.target.value)} placeholder="e.g. innovation, results-driven, community" className="bg-card/50 border-border/40" /><p className="text-xs text-muted-foreground">Separate with commas.</p></div>
                <div className="space-y-2"><Label className="font-semibold">Words / Topics to Avoid</Label><Input value={brandAvoid} onChange={(e) => setBrandAvoid(e.target.value)} placeholder="e.g. cheap, problems, competitor names" className="bg-card/50 border-border/40" /></div>
                <Button onClick={handleSaveBrandVoice} className="gap-2 bg-gradient-to-r from-violet-500 to-pink-500 text-white border-0 h-11 px-8">
                  {brandSaved ? <><Check className="h-4 w-4" />Saved!</> : <><Megaphone className="h-4 w-4" />Save Brand Voice</>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════ ANALYTICS ══════════════════════════ */}
          {view === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="p-6 lg:p-8 space-y-8">
              <div><h2 className="text-2xl font-bold">Analytics</h2><p className="text-muted-foreground text-sm mt-1">Track performance across platforms.</p></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Reach", value: "12.4K", delta: "+18%", icon: Eye, color: "text-violet-400", bg: "bg-violet-400/10" },
                  { label: "Engagement Rate", value: "6.4%", delta: "+2.1%", icon: TrendingUp, color: "text-pink-400", bg: "bg-pink-400/10" },
                  { label: "Total Likes", value: "1.8K", delta: "+34%", icon: Heart, color: "text-red-400", bg: "bg-red-400/10" },
                  { label: "Posts Published", value: "23", delta: "+5", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
                ].map((stat) => (
                  <Card key={stat.label} className="border-border/30 bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2"><div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", stat.bg)}><stat.icon className={cn("h-4 w-4", stat.color)} /></div><span className="text-xs text-green-400 font-semibold">{stat.delta}</span></div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div>
                <h3 className="font-semibold mb-4">Performance by Platform</h3>
                <div className="space-y-4">
                  {PLATFORMS.map((plat) => {
                    const val = Math.floor(Math.random() * 60 + 30);
                    const eng = (Math.random() * 7 + 2).toFixed(1);
                    return (
                      <div key={plat.id} className="flex items-center gap-4">
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0", plat.gradient)}>{plat.emoji}</div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between text-sm"><span className="font-medium">{plat.label}</span><span className="text-muted-foreground">{eng}% engagement</span></div>
                          <div className="w-full bg-secondary/30 rounded-full h-2"><div className={cn("h-2 rounded-full bg-gradient-to-r", plat.gradient)} style={{ width: `${val}%` }} /></div>
                        </div>
                        <span className="text-sm font-semibold w-12 text-right">{val}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-4">Top Performing Posts</h3>
                <div className="space-y-3">
                  {[
                    { platform: "instagram", text: "We just hit 1,000 customers! 🎉 Thank you for being part of our journey...", likes: 342, comments: 45, reach: "4.2K" },
                    { platform: "linkedin", text: "5 lessons we learned scaling from 0 to $1M ARR without venture funding...", likes: 187, comments: 62, reach: "3.1K" },
                    { platform: "twitter", text: "Hot take: the best marketing is a product people can't stop talking about. 🔥", likes: 203, comments: 31, reach: "2.8K" },
                  ].map((post, i) => {
                    const plat = getPlatform(post.platform);
                    return (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-2xl border border-border/30 bg-card/50">
                        <div className="text-muted-foreground text-sm font-semibold w-6 shrink-0">#{i + 1}</div>
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shrink-0", plat.gradient)}>{plat.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{post.text}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="h-3 w-3" />{post.likes}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageCircle className="h-3 w-3" />{post.comments}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{post.reach} reach</span>
                          </div>
                        </div>
                        {i === 0 && <Flame className="h-4 w-4 text-orange-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
