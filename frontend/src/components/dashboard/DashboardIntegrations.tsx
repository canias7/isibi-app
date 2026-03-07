import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, Loader2, Lock, MessageSquare, Send, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getGoogleAuthUrlUserLevel, configureSlack, getSlackStatus, testSlackNotification, disableSlack, configureTeams, getTeamsStatus, testTeamsNotification, disableTeams, configureSquare, getSquareStatus, testSquarePayment, disableSquare, configureShopify, getShopifyStatus, disconnectShopify } from "@/lib/api";
import googleCalendarLogo from "@/assets/google-calendar-logo.png";
import slackLogo from "@/assets/slack-logo.png";
import teamsLogo from "@/assets/teams-logo.png";
import squareLogo from "@/assets/square-logo.png";
import shopifyLogo from "@/assets/shopify-logo.png";
import cloverLogo from "@/assets/clover-logo.png";
import toastLogo from "@/assets/toast-logo.png";
import opentableLogo from "@/assets/opentable-logo.png";
import spotonLogo from "@/assets/spoton-logo.png";
import oloLogo from "@/assets/olo-logo.png";
import alohaLogo from "@/assets/aloha-logo.png";
import skytabLogo from "@/assets/skytab-logo.png";

const logoMap: Record<string, string> = {
  google_calendar: googleCalendarLogo,
  slack: slackLogo,
  teams: teamsLogo,
  square: squareLogo,
  shopify: shopifyLogo,
};

const integrations = [
  { id: "google_calendar", label: "Google Calendar", description: "Sync appointments and manage bookings" },
  { id: "slack", label: "Slack", description: "Call notifications to your workspace" },
  { id: "teams", label: "Microsoft Teams", description: "Call notifications to Teams channels" },
  { id: "square", label: "Square", description: "Accept payments via Square POS" },
  { id: "shopify", label: "Shopify", description: "Connect your Shopify store" },
];

const comingSoon = [
  { name: "Aloha by NCR", logo: alohaLogo },
  { name: "Clover", logo: cloverLogo },
  { name: "Olo", logo: oloLogo },
  { name: "OpenTable", logo: opentableLogo },
  { name: "SkyTab", logo: skytabLogo },
  { name: "SpotOn", logo: spotonLogo, whiteBg: true },
  { name: "Toast", logo: toastLogo },
];

export default function DashboardIntegrations() {
  const [selected, setSelected] = useState("google_calendar");

  // Slack
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackChannel, setSlackChannel] = useState("#calls");
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);

  // Teams
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState("");
  const [teamsConnected, setTeamsConnected] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsTesting, setTeamsTesting] = useState(false);

  // Square
  const [squareAccessToken, setSquareAccessToken] = useState("");
  const [squareEnvironment, setSquareEnvironment] = useState("sandbox");
  const [squareConnected, setSquareConnected] = useState(false);
  const [squareLoading, setSquareLoading] = useState(false);
  const [squareTesting, setSquareTesting] = useState(false);

  // Shopify
  const [shopifyShopName, setShopifyShopName] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShopNameDisplay, setShopifyShopNameDisplay] = useState<string | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);

  useEffect(() => {
    getSlackStatus().then((s) => { setSlackConnected(s.enabled); if (s.channel) setSlackChannel(s.channel); }).catch(() => {});
    getTeamsStatus().then((s) => { setTeamsConnected(s.enabled); if (s.webhook_url) setTeamsWebhookUrl(s.webhook_url); }).catch(() => {});
    getSquareStatus().then((s) => { setSquareConnected(s.enabled); if (s.environment) setSquareEnvironment(s.environment); }).catch(() => {});
    getShopifyStatus().then((s) => { setShopifyConnected(s.enabled); if (s.shop_name) setShopifyShopNameDisplay(s.shop_name); }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect your AI agent to external services.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Integration list */}
        <div className="space-y-2">
          {integrations.map((item) => (
            <button key={item.id} onClick={() => setSelected(item.id)} className={cn("w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all", selected === item.id ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/40 hover:border-border/60")}>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0 overflow-hidden", item.id === "square" ? "bg-white" : "bg-background")}>
                <img src={logoMap[item.id]} alt={item.label} className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </button>
          ))}
          {comingSoon.map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-4 rounded-xl border border-border/20 bg-card/20 opacity-50">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0 overflow-hidden", item.whiteBg ? "bg-white" : "bg-background")}>
                <img src={item.logo} alt={item.name} className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" />Coming Soon</p>
              </div>
            </div>
          ))}
        </div>

        {/* Config panel */}
        <motion.div key={selected} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
          {selected === "google_calendar" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Google Calendar</h3>
              <p className="text-sm text-muted-foreground">Sync appointments and manage bookings directly from your calendar.</p>
              <Button variant="outline" className="gap-2" onClick={async () => { try { const authUrl = await getGoogleAuthUrlUserLevel(); window.open(authUrl, "google-auth", "width=600,height=700"); } catch (err) { toast({ title: "Failed", description: String(err), variant: "destructive" }); } }}>
                <ExternalLink className="h-4 w-4" />Connect Google Account
              </Button>
            </div>
          )}

          {selected === "slack" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Slack</h3>
              {slackConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />Connected ({slackChannel})</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={slackTesting} onClick={async () => { setSlackTesting(true); try { await testSlackNotification(); toast({ title: "Test sent!" }); } catch (err) { toast({ title: "Failed", variant: "destructive" }); } finally { setSlackTesting(false); } }}>
                      {slackTesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}Test
                    </Button>
                    <Button variant="destructive" size="sm" onClick={async () => { setSlackLoading(true); try { await disableSlack(); setSlackConnected(false); } catch {} finally { setSlackLoading(false); } }}>Disconnect</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Bot Token</Label><Input type="password" placeholder="xoxb-..." value={slackBotToken} onChange={(e) => setSlackBotToken(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Channel</Label><Input placeholder="#calls" value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} /></div>
                  <Button disabled={!slackBotToken || slackLoading} onClick={async () => { setSlackLoading(true); try { await configureSlack({ slack_bot_token: slackBotToken, slack_default_channel: slackChannel, slack_enabled: true }); setSlackConnected(true); toast({ title: "Connected!" }); } catch (err) { toast({ title: "Failed", variant: "destructive" }); } finally { setSlackLoading(false); } }}>
                    {slackLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}Connect
                  </Button>
                </div>
              )}
            </div>
          )}

          {selected === "teams" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Microsoft Teams</h3>
              {teamsConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />Connected</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={teamsTesting} onClick={async () => { setTeamsTesting(true); try { await testTeamsNotification(); toast({ title: "Test sent!" }); } catch {} finally { setTeamsTesting(false); } }}><Send className="h-4 w-4 mr-1" />Test</Button>
                    <Button variant="destructive" size="sm" onClick={async () => { setTeamsLoading(true); try { await disableTeams(); setTeamsConnected(false); } catch {} finally { setTeamsLoading(false); } }}>Disconnect</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Webhook URL</Label><Input type="url" placeholder="https://..." value={teamsWebhookUrl} onChange={(e) => setTeamsWebhookUrl(e.target.value)} /></div>
                  <Button disabled={!teamsWebhookUrl || teamsLoading} onClick={async () => { setTeamsLoading(true); try { await configureTeams({ teams_webhook_url: teamsWebhookUrl, teams_enabled: true }); setTeamsConnected(true); toast({ title: "Connected!" }); } catch {} finally { setTeamsLoading(false); } }}>Connect</Button>
                </div>
              )}
            </div>
          )}

          {selected === "square" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Square</h3>
              {squareConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />Connected ({squareEnvironment})</div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={squareTesting} onClick={async () => { setSquareTesting(true); try { await testSquarePayment(); toast({ title: "Test payment sent!" }); } catch {} finally { setSquareTesting(false); } }}><Send className="h-4 w-4 mr-1" />Test</Button>
                    <Button variant="destructive" size="sm" onClick={async () => { setSquareLoading(true); try { await disableSquare(); setSquareConnected(false); } catch {} finally { setSquareLoading(false); } }}>Disconnect</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <select value={squareEnvironment} onChange={(e) => setSquareEnvironment(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                      <option value="sandbox">Sandbox</option><option value="production">Production</option>
                    </select>
                  </div>
                  <div className="space-y-2"><Label>Access Token</Label><Input type="password" placeholder="Square Access Token" value={squareAccessToken} onChange={(e) => setSquareAccessToken(e.target.value)} /></div>
                  <Button disabled={!squareAccessToken || squareLoading} onClick={async () => { setSquareLoading(true); try { await configureSquare({ square_access_token: squareAccessToken, square_environment: squareEnvironment }); setSquareConnected(true); toast({ title: "Connected!" }); } catch {} finally { setSquareLoading(false); } }}>Connect</Button>
                </div>
              )}
            </div>
          )}

          {selected === "shopify" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Shopify</h3>
              {shopifyConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />Connected {shopifyShopNameDisplay && `(${shopifyShopNameDisplay}.myshopify.com)`}</div>
                  <Button variant="destructive" size="sm" onClick={async () => { if (!confirm("Disconnect Shopify?")) return; setShopifyLoading(true); try { await disconnectShopify(); setShopifyConnected(false); setShopifyShopNameDisplay(null); } catch {} finally { setShopifyLoading(false); } }}>Disconnect</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Store name</Label><Input placeholder="your-store" value={shopifyShopName} onChange={(e) => setShopifyShopName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Admin API Access Token</Label><Input type="password" placeholder="shpat_xxxxx" value={shopifyAccessToken} onChange={(e) => setShopifyAccessToken(e.target.value)} /></div>
                  <Button disabled={!shopifyShopName.trim() || !shopifyAccessToken.trim() || shopifyLoading} onClick={async () => { setShopifyLoading(true); try { const data = await configureShopify({ shop_name: shopifyShopName.trim(), access_token: shopifyAccessToken.trim() }); if (data.success) { setShopifyConnected(true); setShopifyShopNameDisplay(shopifyShopName.trim()); toast({ title: "Connected!", description: `${data.product_count ?? 0} products found` }); } } catch (err) { toast({ title: "Failed", variant: "destructive" }); } finally { setShopifyLoading(false); } }}>
                    {shopifyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShoppingBag className="h-4 w-4 mr-2" />}Connect
                  </Button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
