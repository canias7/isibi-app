import { useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { getAutoRechargeConfig, configureAutoRecharge } from "@/lib/api";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const STRIPE_PK = "pk_live_51SgtI596d7cJIYQByJXmy98CFJkebcHTii1v2b96oXmZ50B27xbcrXiSe5CSPhrInMX2ceBLFGGZch8XvdVBDS5s00GJss7qlu";
const stripePromise = loadStripe(STRIPE_PK);

function AutoRechargeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState("10");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [editingCard, setEditingCard] = useState(false);

  useEffect(() => {
    getAutoRechargeConfig()
      .then((config) => {
        setEnabled(config.enabled ?? false);
        setAmount(String(config.amount ?? 10));
        setHasPaymentMethod(!!config.payment_method_id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!stripe || !elements) return;

    setSaving(true);
    try {
      let paymentMethodId: string | undefined;

      if (editingCard || (!hasPaymentMethod && enabled)) {
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          toast({ title: "Please enter card details", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { paymentMethod, error } = await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
        });
        if (error || !paymentMethod) {
          toast({ title: "Card error", description: error?.message ?? "Failed to save card", variant: "destructive" });
          setSaving(false);
          return;
        }
        paymentMethodId = paymentMethod.id;
      }

      await configureAutoRecharge({
        enabled,
        amount: parseFloat(amount) || 10,
        ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
      });

      if (paymentMethodId) {
        setHasPaymentMethod(true);
        setEditingCard(false);
      }

      toast({ title: enabled ? "Auto-recharge enabled" : "Auto-recharge disabled" });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const showCardInput = enabled && (editingCard || !hasPaymentMethod);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">Auto-Recharge</CardTitle>
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground">Enable auto-recharge</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Recharge amount ($)</label>
              <Input
                type="number"
                min="5"
                step="1"
                className="h-8 text-xs"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Automatically recharge when balance is low
              </p>
            </div>

            {hasPaymentMethod && !editingCard && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Card on file ✓</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingCard(true)}>
                  Change
                </Button>
              </div>
            )}

            {showCardInput && (
              <div className="rounded-md border border-border p-3">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: "12px",
                        color: "#fff",
                        "::placeholder": { color: "#888" },
                      },
                    },
                  }}
                />
              </div>
            )}
          </>
        )}

        <Button
          variant="hero"
          className="w-full h-8 text-xs"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AutoRechargeCard() {
  return (
    <Elements stripe={stripePromise}>
      <AutoRechargeForm />
    </Elements>
  );
}
