import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { listAgents, type AgentOut, getCreditsBalance, getCreditsStatus, getTransactions, getCurrentUsage, getUsageCalls } from "@/lib/api";
import { getMyPhoneNumbers, type PurchasedNumber } from "@/lib/phone-numbers-api";
import DashboardSidebar, { type DashboardTab } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";

import DashboardPhoneNumbers from "@/components/dashboard/DashboardPhoneNumbers";
import DashboardBilling from "@/components/dashboard/DashboardBilling";
import DashboardAISettings, { type AgentPricingConfig } from "@/components/dashboard/DashboardAISettings";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import DashboardVoiceLibrary from "@/components/dashboard/DashboardVoiceLibrary";
import DashboardDeveloper from "@/components/dashboard/DashboardDeveloper";
import DashboardRightPanel, { type RightPanelTab, type AgentConfigForPricing } from "@/components/dashboard/DashboardRightPanel";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  // Determine initial tab: if editing, go to AI settings
  const [activeTab, setActiveTab] = useState<DashboardTab>("assistant");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("pricing");
  const [agentPricingConfig, setAgentPricingConfig] = useState<AgentConfigForPricing>({});
  const [isEditingAgent, setIsEditingAgent] = useState(!!editId);

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

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex min-h-screen relative">
      {/* Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        balance={balance}
        lowBalance={lowBalance}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content */}
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
            <DashboardAISettings agents={agents} onAgentsRefresh={fetchAgents} onPricingConfigChange={setAgentPricingConfig} onEditingChange={setIsEditingAgent} />
          </div>
          {activeTab === "voice-library" && (
            <DashboardVoiceLibrary />
          )}
          {activeTab === "settings" && (
            <DashboardSettings />
          )}
          {activeTab === "developer" && (
            <DashboardDeveloper />
          )}
        </div>
      </main>

      {/* Right panel – only visible when editing/creating an agent */}
      {activeTab === "assistant" && isEditingAgent && (
        <DashboardRightPanel activeTab={rightPanelTab} onTabChange={setRightPanelTab} agentConfig={agentPricingConfig} calls={calls} />
      )}
    </div>
  );
}
