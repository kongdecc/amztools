import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";

const Home = lazy(() => import("@/pages/Home"));
const ReportHub = lazy(() => import("@/pages/ReportHub"));
const TargetingReportPage = lazy(() => import("@/pages/TargetingReportPage"));
const CampaignReportPage = lazy(() => import("@/pages/CampaignReportPage"));
const PlacementReportPage = lazy(() => import("@/pages/PlacementReportPage"));
const BudgetReportPage = lazy(() => import("@/pages/BudgetReportPage"));
const AdvertisedProductReportPage = lazy(() => import("@/pages/AdvertisedProductReportPage"));
const PurchasedProductReportPage = lazy(() => import("@/pages/PurchasedProductReportPage"));
const SearchTermImpressionShareReportPage = lazy(() => import("@/pages/SearchTermImpressionShareReportPage"));
const PerformanceOverTimeReportPage = lazy(() => import("@/pages/PerformanceOverTimeReportPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Use hash-based routing (/#/) to support opening index.html directly via file:// protocol
function AppRouter() {
  return (
    <Router hook={useHashLocation}>
      <Suspense fallback={null}>
        <Switch>
          <Route path="/" component={ReportHub} />
          <Route path="/search-term" component={Home} />
          <Route path="/targeting-report" component={TargetingReportPage} />
          <Route path="/campaign-report" component={CampaignReportPage} />
          <Route path="/placement-report" component={PlacementReportPage} />
          <Route path="/budget-report" component={BudgetReportPage} />
          <Route path="/advertised-product-report" component={AdvertisedProductReportPage} />
          <Route path="/purchased-product-report" component={PurchasedProductReportPage} />
          <Route path="/search-term-impression-share-report" component={SearchTermImpressionShareReportPage} />
          <Route path="/performance-over-time-report" component={PerformanceOverTimeReportPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Router>
  );
}

// Note on theming:
// - Choose defaultTheme based on your design (light or dark background)
// - Update the color palette in index.css to match
// - If you want switchable themes, add `switchable` prop and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
