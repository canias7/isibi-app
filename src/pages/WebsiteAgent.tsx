import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Globe, CheckCircle, Loader2, ArrowRight, ChevronDown, ChevronUp, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

const API_BASE_URL = "https://isibi-backend.onrender.com";

const GOAL_OPTIONS = [
  { value: "get_calls", label: "Get more calls" },
  { value: "book_appointments", label: "Book appointments" },
  { value: "sell_products", label: "Sell products" },
  { value: "show_services", label: "Show services" },
  { value: "other", label: "Other" },
];

const ACTION_OPTIONS = [
  { value: "call", label: "Call you" },
  { value: "book_online", label: "Book online" },
  { value: "send_message", label: "Send a message" },
  { value: "visit_location", label: "Visit your location" },
];

const FEATURE_OPTIONS = [
  { value: "online_booking", label: "Online booking" },
  { value: "contact_form", label: "Contact form" },
  { value: "google_maps", label: "Google Maps" },
  { value: "reviews", label: "Reviews" },
];

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 bg-card/60 hover:bg-card/80 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center shrink-0">
            {number}
          </span>
          <span className="font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 py-5 space-y-4 bg-card/30">{children}</div>}
    </div>
  );
}

function MultiCheck({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Badge
          key={o.value}
          variant={selected.includes(o.value) ? "default" : "outline"}
          className="cursor-pointer select-none px-3 py-1.5 text-sm transition-all hover:opacity-80"
          onClick={() => toggle(o.value)}
        >
          {selected.includes(o.value) && <CheckCircle className="h-3 w-3 mr-1" />}
          {o.label}
        </Badge>
      ))}
    </div>
  );
}

// Convert a File to a base64 data-URL string
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function WebsiteAgent() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);

  const FALLBACK_PAYMENT_URL = "https://buy.stripe.com/aFaaER3zN0ckdGS8taeIw06";

  // File upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  // Multi-select state
  const [goals, setGoals] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  const [form, setForm] = useState({
    // Section 1
    full_name: "",
    email: "",
    phone: "",
    business_name: "",
    business_address: "",
    business_hours: "",
    current_website: "",
    // Section 2
    business_description: "",
    services_offered: "",
    competitive_advantage: "",
    // Section 4
    services_list: "",
    pricing_info: "",
    special_offers: "",
    // Section 5
    preferred_colors: "",
    website_examples: "",
    has_logo: "no",
    // Section 6
    has_photos: "no",
    // Section 8
    social_facebook: "",
    social_instagram: "",
    social_tiktok: "",
    social_google: "",
    // Section 9
    additional_notes: "",
  });

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.business_name) {
      toast({ title: "Please fill in the required fields (name, email, business name)", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Encode uploaded files as base64
      let logoData: string | null = null;
      let logoFilename: string | null = null;
      if (logoFile) {
        logoData = await fileToBase64(logoFile);
        logoFilename = logoFile.name;
      }
      let photosData: string[] = [];
      let photosFilenames: string[] = [];
      for (const f of photoFiles) {
        photosData.push(await fileToBase64(f));
        photosFilenames.push(f.name);
      }

      const res = await fetch(`${API_BASE_URL}/api/website-agent/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          website_goals: goals.join(", "),
          customer_actions: actions.join(", "),
          features_needed: features.join(", "),
          logo_data: logoData,
          logo_filename: logoFilename,
          photos_data: photosData.length ? JSON.stringify(photosData) : null,
          photos_filenames: photosFilenames.length ? JSON.stringify(photosFilenames) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Submission failed");
      }

      const data = await res.json();
      setOrderId(data.order_id);
      setClientSecret(data.client_secret || null);
      setCheckoutUrl(data.checkout_url || null);

      toast({
        title: "Request submitted!",
        description: "Complete the payment below to confirm your order.",
      });
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Payment success screen ─────────────────────────────────────────────────
  if (paymentDone) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Payment Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you! Your order <span className="font-semibold text-foreground">#{orderId}</span> is confirmed.
            We'll start building your website and reach out within 1 business day.
          </p>
          <Link to="/">
            <Button variant="outline" className="mt-4">Back to Home</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Payment screen (shown after successful form submit) ────────────────────
  if (orderId && !paymentDone) {
    const payUrl = checkoutUrl || FALLBACK_PAYMENT_URL;

    return (
      <div className="min-h-screen relative py-12 px-4">
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold gradient-text">ISIBI</span>
            </Link>
            <h1 className="text-2xl font-bold">Complete Your Payment</h1>
            <p className="text-muted-foreground text-sm">
              Order <span className="font-semibold text-foreground">#{orderId}</span> — Website Build Service · $1.00
            </p>
          </div>

          {clientSecret ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
              <CardContent className="p-0">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    onComplete: () => setPaymentDone(true),
                  }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 bg-card/50 backdrop-blur-xl">
              <CardContent className="pt-6 space-y-5 text-center">
                <div className="space-y-1">
                  <p className="font-semibold text-lg">ISIBI Website Build Service</p>
                  <p className="text-muted-foreground text-sm">Custom website for {form.business_name || form.full_name}</p>
                </div>
                <div className="text-4xl font-bold">$1.00</div>
                <div className="border-t pt-4 space-y-1.5 text-sm text-muted-foreground text-left">
                  <p>✓ Custom design tailored to your brand</p>
                  <p>✓ Mobile responsive</p>
                  <p>✓ All requested features included</p>
                  <p>✓ Delivered within 5–7 business days</p>
                </div>
                <Button
                  size="lg"
                  className="w-full text-base font-semibold"
                  onClick={() => window.open(payUrl, "_blank")}
                >
                  Pay Now — $1.00
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground">Secured by Stripe · Order #{orderId}</p>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Payments are processed securely by Stripe. ISIBI never stores your card details.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative py-16 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-2xl font-bold gradient-text">ISIBI</span>
          </Link>
          <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 mb-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Website Build Service</span>
          </div>
          <h1 className="text-4xl font-bold">Website Project Questionnaire</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Fill out the form below so we can build your perfect website.{" "}
            <span className="font-semibold text-foreground">$1.00</span> — one flat fee.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 1. Business Information */}
            <Section number={1} title="Business Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Business Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Acme Corp" value={form.business_name} onChange={set("business_name")} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Business Address</Label>
                  <Input placeholder="123 Main St, City, State" value={form.business_address} onChange={set("business_address")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone Number <span className="text-destructive">*</span></Label>
                  <Input type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={set("phone")} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address <span className="text-destructive">*</span></Label>
                  <Input type="email" placeholder="you@business.com" value={form.email} onChange={set("email")} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Current Website <span className="text-muted-foreground font-normal">(if you have one)</span></Label>
                  <Input placeholder="https://example.com" value={form.current_website} onChange={set("current_website")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Business Hours</Label>
                  <Input placeholder="Mon–Fri 9am–5pm, Sat 10am–3pm" value={form.business_hours} onChange={set("business_hours")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Your Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="Jane Smith" value={form.full_name} onChange={set("full_name")} required />
                </div>
              </div>
            </Section>

            {/* 2. About Your Business */}
            <Section number={2} title="About Your Business">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Brief description of your business</Label>
                  <Textarea
                    placeholder="We are a family-owned restaurant serving authentic Mexican cuisine…"
                    value={form.business_description}
                    onChange={set("business_description")}
                    rows={3}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>What services or products do you offer?</Label>
                  <Textarea
                    placeholder="Haircuts, color treatments, blowouts, waxing…"
                    value={form.services_offered}
                    onChange={set("services_offered")}
                    rows={3}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>What makes your business different from competitors?</Label>
                  <Textarea
                    placeholder="We use only organic products and offer free consultations…"
                    value={form.competitive_advantage}
                    onChange={set("competitive_advantage")}
                    rows={2}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </Section>

            {/* 3. Website Goals */}
            <Section number={3} title="Website Goals">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>What is the main goal of the website? <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
                  <MultiCheck options={GOAL_OPTIONS} selected={goals} onChange={setGoals} />
                </div>
                <div className="space-y-2">
                  <Label>Do you want customers to: <span className="text-muted-foreground font-normal">(select all that apply)</span></Label>
                  <MultiCheck options={ACTION_OPTIONS} selected={actions} onChange={setActions} />
                </div>
              </div>
            </Section>

            {/* 4. Services / Products */}
            <Section number={4} title="Services / Products">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>List your main services or products</Label>
                  <Textarea
                    placeholder="1. Haircut – $40&#10;2. Color – $80&#10;3. Blowout – $35"
                    value={form.services_list}
                    onChange={set("services_list")}
                    rows={4}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pricing <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input placeholder="Starting at $40 / Custom pricing available" value={form.pricing_info} onChange={set("pricing_info")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Any special offers or promotions?</Label>
                  <Input placeholder="10% off first visit, free consultation…" value={form.special_offers} onChange={set("special_offers")} />
                </div>
              </div>
            </Section>

            {/* 5. Design Preferences */}
            <Section number={5} title="Design Preferences">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Do you have a logo?</Label>
                  <div className="flex gap-3">
                    {["yes", "no"].map((v) => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="has_logo"
                          value={v}
                          checked={form.has_logo === v}
                          onChange={set("has_logo")}
                          className="accent-primary"
                        />
                        <span className="capitalize text-sm">{v}</span>
                      </label>
                    ))}
                  </div>
                  {form.has_logo === "yes" && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Upload your logo</Label>
                      {logoFile ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                          <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate flex-1">{logoFile.name}</span>
                          <button type="button" onClick={() => setLogoFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 cursor-pointer transition-colors">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Click to upload logo (PNG, JPG, SVG)</span>
                          <input
                            type="file"
                            accept="image/*,.svg"
                            className="hidden"
                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred colors</Label>
                  <Input placeholder="Navy blue and gold, earthy greens, match our logo…" value={form.preferred_colors} onChange={set("preferred_colors")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Websites you like <span className="text-muted-foreground font-normal">(examples / inspiration)</span></Label>
                  <Textarea
                    placeholder="https://example.com — I love their clean layout&#10;https://another.com — great color scheme"
                    value={form.website_examples}
                    onChange={set("website_examples")}
                    rows={3}
                    className="bg-background/50"
                  />
                </div>
              </div>
            </Section>

            {/* 6. Content */}
            <Section number={6} title="Content">
              <div className="space-y-2">
                <Label>Do you already have photos of your business?</Label>
                <div className="flex gap-3">
                  {["yes", "no"].map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="has_photos"
                        value={v}
                        checked={form.has_photos === v}
                        onChange={set("has_photos")}
                        className="accent-primary"
                      />
                      <span className="capitalize text-sm">{v}</span>
                    </label>
                  ))}
                </div>
                {form.has_photos === "yes" && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Upload your photos <span className="font-normal">(up to 5 images)</span></Label>
                    {photoFiles.length > 0 && (
                      <div className="space-y-1.5">
                        {photoFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                            <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                            <span className="text-sm truncate flex-1">{f.name}</span>
                            <button type="button" onClick={() => setPhotoFiles(photoFiles.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {photoFiles.length < 5 && (
                      <label className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border/60 hover:border-primary/40 cursor-pointer transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click to upload photos (PNG, JPG)</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setPhotoFiles((prev) => [...prev, ...files].slice(0, 5));
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
                {form.has_photos === "no" && (
                  <p className="text-xs text-muted-foreground bg-secondary/30 border border-border/50 rounded px-3 py-2">
                    No problem — we can use high-quality stock photos that match your industry.
                  </p>
                )}
              </div>
            </Section>

            {/* 7. Features Needed */}
            <Section number={7} title="Features Needed">
              <div className="space-y-2">
                <Label>Select the features you want:</Label>
                <MultiCheck options={FEATURE_OPTIONS} selected={features} onChange={setFeatures} />
              </div>
            </Section>

            {/* 8. Social Media */}
            <Section number={8} title="Social Media">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Facebook</Label>
                  <Input placeholder="https://facebook.com/yourbusiness" value={form.social_facebook} onChange={set("social_facebook")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram</Label>
                  <Input placeholder="https://instagram.com/yourbusiness" value={form.social_instagram} onChange={set("social_instagram")} />
                </div>
                <div className="space-y-1.5">
                  <Label>TikTok</Label>
                  <Input placeholder="https://tiktok.com/@yourbusiness" value={form.social_tiktok} onChange={set("social_tiktok")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Google Business Profile</Label>
                  <Input placeholder="https://g.page/yourbusiness" value={form.social_google} onChange={set("social_google")} />
                </div>
              </div>
            </Section>

            {/* 9. Additional Information */}
            <Section number={9} title="Additional Information">
              <div className="space-y-1.5">
                <Label>Anything else you would like on your website?</Label>
                <Textarea
                  placeholder="Any specific functionality, integrations, or requirements…"
                  value={form.additional_notes}
                  onChange={set("additional_notes")}
                  rows={4}
                  className="bg-background/50"
                />
              </div>
            </Section>

            {/* Price summary */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">Custom Website Build</p>
                <p className="text-sm text-muted-foreground">Professional · Mobile responsive · 5–7 business days</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">$1.00</p>
                <p className="text-xs text-muted-foreground">+ applicable tax</p>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full text-base font-semibold" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
              ) : (
                <>Submit & Proceed to Payment <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By submitting you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>.
              Payment is processed securely by Stripe.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
