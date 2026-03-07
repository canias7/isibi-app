import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Plus, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripeCheckoutForm } from "@/components/billing/StripeCheckoutForm";
import { AutoRechargeCard } from "@/components/billing/AutoRechargeCard";
import { createPaymentIntent } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const STRIPE_PK = "pk_live_51SgtI596d7cJIYQByJXmy98CFJkebcHTii1v2b96oXmZ50B27xbcrXiSe5CSPhrInMX2ceBLFGGZch8XvdVBDS5s00GJss7qlu";
const stripePromise = loadStripe(STRIPE_PK);
const presetAmounts = [5, 10, 25, 50];

interface DashboardBillingProps {
  balance: number | null;
  lowBalance: boolean;
  transactions: any[];
  onRefresh: () => void;
}

export default function DashboardBilling({ balance, lowBalance, transactions, onRefresh }: DashboardBillingProps) {
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingIntent, setCreatingIntent] = useState(false);

  const handleStartPayment = async () => {
    const amount = parseFloat(purchaseAmount);
    if (!amount || amount <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    setCreatingIntent(true);
    try {
      const { client_secret } = await createPaymentIntent({ amount });
      setClientSecret(client_secret);
    } catch (err: any) {
      toast({ title: "Payment setup failed", description: err.message, variant: "destructive" });
    } finally {
      setCreatingIntent(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast({ title: "Payment successful!", description: `$${parseFloat(purchaseAmount).toFixed(2)} credits added.` });
    setClientSecret(null); setPurchaseAmount(""); setDialogOpen(false); onRefresh();
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setClientSecret(null); setPurchaseAmount(""); }
  };

  // Purchase order transactions
  const poTxs = transactions.filter((tx: any) => tx.type === "purchase" || tx.description?.toLowerCase().includes("phone"));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Billing & Credits</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your credit balance and payment methods.</p>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Current Balance</p>
            <p className="text-4xl font-bold text-foreground">${balance?.toFixed(2) ?? "0.00"}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {presetAmounts.map((amt) => (
            <Button key={amt} variant="outline" onClick={() => { setPurchaseAmount(String(amt)); setDialogOpen(true); }}>
              ${amt}
            </Button>
          ))}
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button variant="default" className="w-full"><Plus className="h-4 w-4 mr-2" />Purchase Credits</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Purchase Credits</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              {!clientSecret ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Amount ($)</label>
                    <Input type="number" min="1" step="0.01" placeholder="Enter amount" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {presetAmounts.map((amt) => (<Button key={amt} variant="outline" size="sm" onClick={() => setPurchaseAmount(String(amt))}>${amt}</Button>))}
                  </div>
                  <Button className="w-full" disabled={creatingIntent || !purchaseAmount || parseFloat(purchaseAmount) <= 0} onClick={handleStartPayment}>
                    {creatingIntent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {creatingIntent ? "Setting up..." : `Continue — $${parseFloat(purchaseAmount || "0").toFixed(2)}`}
                  </Button>
                </>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { fontSizeBase: '14px', spacingUnit: '4px', borderRadius: '8px' } } }}>
                  <StripeCheckoutForm amount={parseFloat(purchaseAmount)} onSuccess={handlePaymentSuccess} onError={(msg) => toast({ title: "Payment failed", description: msg, variant: "destructive" })} />
                </Elements>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Auto Recharge */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
        <AutoRechargeCard />
      </motion.div>

      {/* Transaction History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Transaction History</h3>
        {poTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No purchase transactions yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {poTxs.slice(0, 20).map((tx: any, i: number) => (
              <div key={tx.id || i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/20 border border-border/20">
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.description || tx.type || "Transaction"}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.created_at ? new Date(tx.created_at.endsWith("Z") ? tx.created_at : tx.created_at + "Z").toLocaleString() : "—"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                  {tx.amount >= 0 ? "+" : "−"}${Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
