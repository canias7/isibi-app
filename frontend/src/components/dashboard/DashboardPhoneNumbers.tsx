import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Search, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { searchAvailableNumbers, purchasePhoneNumber, releasePhoneNumber, type PurchasedNumber, type AvailableNumber } from "@/lib/phone-numbers-api";

interface DashboardPhoneNumbersProps {
  myNumbers: PurchasedNumber[];
  onRefresh: () => void;
  onCreditsRefresh: () => void;
}

export default function DashboardPhoneNumbers({ myNumbers, onRefresh, onCreditsRefresh }: DashboardPhoneNumbersProps) {
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const nums = await searchAvailableNumbers("US");
      setAvailableNumbers(nums);
    } catch (err: any) {
      toast({ title: "Failed to search", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async (phone: string) => {
    setPurchasing(phone);
    try {
      await purchasePhoneNumber(phone);
      toast({ title: "Number purchased!", description: `${phone} — $1.15/mo` });
      setAvailableNumbers((prev) => prev.filter((n) => n.phone_number !== phone));
      onRefresh();
      onCreditsRefresh();
    } catch (err: any) {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    } finally {
      setPurchasing(null);
    }
  };

  const handleRelease = async (phone: string) => {
    if (!confirm(`Release ${phone}?`)) return;
    setReleasing(phone);
    try {
      await releasePhoneNumber(phone);
      toast({ title: "Number released", description: phone });
      onRefresh();
      onCreditsRefresh();
    } catch (err: any) {
      toast({ title: "Release failed", description: err.message, variant: "destructive" });
    } finally {
      setReleasing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Phone Numbers</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your AI agent phone numbers.</p>
        </div>
        <Button variant="outline" onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
          {searching ? "Searching..." : "Find Numbers"}
        </Button>
      </div>

      {/* My Numbers */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Your Numbers ({myNumbers.length})</h3>
        {myNumbers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No phone numbers purchased yet.</p>
        ) : (
          <div className="space-y-2">
            {myNumbers.map((num, i) => (
              <div key={num.id || i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{num.phone_number}</p>
                    <p className="text-xs text-muted-foreground">{num.agent_name ? `→ ${num.agent_name}` : "Unassigned"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRelease(num.phone_number)} disabled={releasing === num.phone_number}>
                  {releasing === num.phone_number ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Available Numbers */}
      {availableNumbers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Available Numbers</h3>
          <div className="space-y-2">
            {availableNumbers.map((num, i) => (
              <div key={num.phone_number || i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 border border-border/20">
                <div>
                  <p className="text-sm font-semibold text-foreground">{num.phone_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {[num.region, num.country].filter(Boolean).join(", ") || "US"} · <span className="font-semibold text-primary">$1.15/mo</span>
                  </p>
                </div>
                <Button variant="default" size="sm" disabled={purchasing === num.phone_number} onClick={() => handlePurchase(num.phone_number)}>
                  {purchasing === num.phone_number ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                  Purchase
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
