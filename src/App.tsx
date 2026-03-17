import { Toaster } from "@/components/ui/toaster";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import AskAIWidget from "./components/AskAIWidget";

import Login from "./pages/Login";
import CustomerLogin from "./pages/CustomerLogin";
import CustomerSignup from "./pages/CustomerSignup";
import CustomerDashboard from "./pages/CustomerDashboard";
import Workflow from "./pages/Workflow";
import CalendarConnected from "./pages/CalendarConnected";
import IntegrationsShowcase from "./pages/IntegrationsShowcase";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import FAQ from "./pages/FAQ";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Security from "./pages/Security";
import AdminDashboard from "./pages/AdminDashboard";
import WebsiteAgent from "./pages/WebsiteAgent";
import CRMAgent from "./pages/CRMAgent";
import Workforce from "./pages/Workforce";
import Accounting from "./pages/Accounting";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

// Customer protected route
const CustP = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute accountType="customer" loginPath="/customer-login">{children}</ProtectedRoute>
);

// Admin / generic protected route (no account type check)
const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AnimatedBackground />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Navigate to="/customer-signup" replace />} />
          <Route path="/customer-login" element={<CustomerLogin />} />
          <Route path="/customer-signup" element={<CustomerSignup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/integrations" element={<IntegrationsShowcase />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/security" element={<Security />} />
          <Route path="/website-agent" element={<WebsiteAgent />} />
          <Route path="/crm-agent" element={<P><CRMAgent /></P>} />

          {/* Customer dashboard */}
          <Route path="/customer-dashboard" element={<CustP><CustomerDashboard /></CustP>} />

          {/* Shared protected */}
          <Route path="/workflow" element={<P><Workflow /></P>} />
          <Route path="/workforce" element={<P><Workforce /></P>} />
          <Route path="/accounting" element={<P><Accounting /></P>} />
          <Route path="/calendar-connected" element={<P><CalendarConnected /></P>} />
          <Route path="/admin" element={<P><AdminDashboard /></P>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <AskAIWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
