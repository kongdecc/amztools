import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Home from "@/pages/Home";
import ReportHub from "@/pages/ReportHub";
import TargetingReportPage from "@/pages/TargetingReportPage";
import CampaignReportPage from "@/pages/CampaignReportPage";
import PlacementReportPage from "@/pages/PlacementReportPage";
import BudgetReportPage from "@/pages/BudgetReportPage";
import AdvertisedProductReportPage from "@/pages/AdvertisedProductReportPage";
import PurchasedProductReportPage from "@/pages/PurchasedProductReportPage";
import SearchTermImpressionShareReportPage from "@/pages/SearchTermImpressionShareReportPage";
import PerformanceOverTimeReportPage from "@/pages/PerformanceOverTimeReportPage";
import NotFound from "@/pages/NotFound";

// Use hash-based routing (/#/) to support opening index.html directly via file:// protocol
function AppRouter() {
  return (
    <Router hook={useHashLocation}>
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
