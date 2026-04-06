import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyTwoFactor from "./pages/VerifyTwoFactor";
import SetupStep1 from "./pages/setup/SetupStep1";
import SetupStep2 from "./pages/setup/SetupStep2";
import SetupStep3 from "./pages/setup/SetupStep3";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="bottom-center" theme="dark" />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-2fa" element={<VerifyTwoFactor />} />

          {/* Setup wizard (no nav bar) */}
          <Route path="/setup/step-1" element={<SetupStep1 />} />
          <Route path="/setup/step-2" element={<SetupStep2 />} />
          <Route path="/setup/step-3" element={<SetupStep3 />} />

          {/* Authenticated routes with layout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
