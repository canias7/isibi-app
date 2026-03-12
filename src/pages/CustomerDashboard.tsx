import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listAgents, type AgentOut, getCreditsBalance, getCreditsStatus, getTransactions, getCurrentUsage, getUsageCalls } from "@/lib/api";
import { getMyPhoneNumbers, type PurchasedNumber } from "@/lib/phone-numbers-api";
import DashboardSidebar, { type DashboardTab } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardPhoneNumbers from "@/components/dashboard/DashboardPhoneNumbers";
import DashboardBilling from "@/components/dashboard/DashboardBilling";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import CustomerDashboardAISettings from "@/components/dashboard/CustomerDashboardAISettings";
import DashboardOutboundCalls from "@/components/dashboard/DashboardOutboundCalls";

// Customer tabs only – no Voice Library, no Developer
export type CustomerTab = "assistant" | "overview" | "phone-numbers" | "billing" | "settings";

export default function CustomerDashboard() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [activeTab, setActiveTab] = useState<DashboardTab>("assistant");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Shared data
  const [agents, setAgents] = useState<AgentOut[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [lowBalance, setLowBalance] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [myNumbers, setMyNumbers] = useState<PurchasedNumber[]>([]);

  const fetchAgents = () => {
    listAgents().then(setAgents).catch(() => setAgents([]));
  };

  const fetchCreditsData = async () => {
    try {
      const [balRes, statusRes, txRes, usageRes, callsRes] = await Promise.all([
        getCreditsBalance(), getCreditsStatus(), getTransactions(50), getCurrentUsage(), getUsageCalls(),
      ]);
      setBalance(balRes.balance ?? 0);
      setLowBalance(statusRes.low_balance ?? false);
      const txData = txRes as any;
      setTransactions(txData?.transactions ?? (Array.isArray(txData) ? txData : []));
      setUsage(usageRes);
      const callsData = callsRes as any;
      setCalls(callsData?.calls ?? (Array.isArray(callsData) ? callsData : []));
    } catch {}
  };

  const fetchMyNumbers = async () => {
    try {
      const nums = await getMyPhoneNumbers();
      setMyNumbers(Array.isArray(nums) ? nums : (nums as any)?.numbers ?? []);
    } catch {}
  };

  useEffect(() => {
    fetchAgents();
    fetchCreditsData();
    fetchMyNumbers();
    const i = setInterval(fetchCreditsData, 30000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="flex min-h-screen relative">
      {/* Sidebar – customer mode (no Voice Library, no Developer, no Workflow) */}
      <DashboardSidebar
        mode="customer"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        balance={balance}
        lowBalance={lowBalance}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content – no right panel */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === "overview" && (
            <DashboardOverview
              balance={balance}
              lowBalance={lowBalance}
              usage={usage}
              calls={calls}
              agents={agents}
              transactions={transactions}
            />
          )}
          {activeTab === "phone-numbers" && (
            <DashboardPhoneNumbers
              myNumbers={myNumbers}
              onRefresh={fetchMyNumbers}
              onCreditsRefresh={fetchCreditsData}
            />
          )}
          {activeTab === "billing" && (
            <DashboardBilling
              balance={balance}
              lowBalance={lowBalance}
              transactions={transactions}
              onRefresh={fetchCreditsData}
            />
          )}
          {/* Keep AI Settings mounted so in-progress work isn't lost */}
          <div className={activeTab === "assistant" ? "" : "hidden"}>
            <CustomerDashboardAISettings
              agents={agents}
              onAgentsRefresh={fetchAgents}
            />
          </div>
          {activeTab === "outbound-calls" && <DashboardOutboundCalls agents={agents} />}
          {activeTab === "settings" && <DashboardSettings />}
        </div>
      </main>
      {/* No right panel for customer dashboard */}
    </div>
  );
}
