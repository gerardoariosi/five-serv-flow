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
import ClientList from "./pages/clients/ClientList";
import ClientDetail from "./pages/clients/ClientDetail";
import ClientForm from "./pages/clients/ClientForm";
import ZoneList from "./pages/zones/ZoneList";
import PropertyList from "./pages/properties/PropertyList";
import PropertyDetail from "./pages/properties/PropertyDetail";
import PropertyForm from "./pages/properties/PropertyForm";
import TicketList from "./pages/tickets/TicketList";
import TicketDetail from "./pages/tickets/TicketDetail";
import TicketForm from "./pages/tickets/TicketForm";
import TicketWork from "./pages/tickets/TicketWork";
import TicketReview from "./pages/tickets/TicketReview";
import TechnicianDashboard from "./pages/tickets/TechnicianDashboard";
import InspectionList from "./pages/inspections/InspectionList";
import CreateInspection from "./pages/inspections/CreateInspection";
import AreaInspection from "./pages/inspections/AreaInspection";
import PricingReview from "./pages/inspections/PricingReview";
import InspectionDetail from "./pages/inspections/InspectionDetail";
import PMPortal from "./pages/inspections/PMPortal";
import TechnicianList from "./pages/team/TechnicianList";
import TechnicianDetail from "./pages/team/TechnicianDetail";
import VendorDetail from "./pages/team/VendorDetail";
import AccountingList from "./pages/accounting/AccountingList";
import AccountingDetail from "./pages/accounting/AccountingDetail";
import CalendarPage from "./pages/calendar/CalendarPage";
import ReportList from "./pages/reports/ReportList";
import ReportDetail from "./pages/reports/ReportDetail";
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
            <Route path="/clients" element={<ClientList />} />
            <Route path="/clients/new" element={<ClientForm />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/clients/:id/edit" element={<ClientForm />} />
            <Route path="/zones" element={<ZoneList />} />
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/properties/new" element={<PropertyForm />} />
            <Route path="/properties/:id" element={<PropertyDetail />} />
            <Route path="/properties/:id/edit" element={<PropertyForm />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/new" element={<TicketForm />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/tickets/:id/edit" element={<TicketForm />} />
            <Route path="/tickets/:id/work" element={<TicketWork />} />
            <Route path="/tickets/:id/review" element={<TicketReview />} />
            <Route path="/my-work" element={<TechnicianDashboard />} />
            <Route path="/inspections" element={<InspectionList />} />
            <Route path="/inspections/new" element={<CreateInspection />} />
            <Route path="/inspections/:id" element={<InspectionDetail />} />
            <Route path="/inspections/:id/inspect" element={<AreaInspection />} />
            <Route path="/inspections/:id/pricing" element={<PricingReview />} />
            <Route path="/team/technicians" element={<TechnicianList />} />
            <Route path="/team/technicians/:id" element={<TechnicianDetail />} />
            <Route path="/team/vendors/new" element={<VendorDetail />} />
            <Route path="/team/vendors/:id" element={<VendorDetail />} />
            <Route path="/accounting" element={<AccountingList />} />
            <Route path="/accounting/:id" element={<AccountingDetail />} />
          </Route>

          {/* Public PM portal */}
          <Route path="/portal/:token" element={<PMPortal />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
