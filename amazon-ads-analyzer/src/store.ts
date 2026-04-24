import { create } from 'zustand';
import type { AdRecord, AnalysisSettings } from '@/types';

interface AppState {
  data: AdRecord[] | null;
  fileName: string | null;
  isLoading: boolean;
  settings: AnalysisSettings;
  filtersVersion: number;
  
  // Actions
  setData: (data: AdRecord[], fileName: string) => void;
  setLoading: (loading: boolean) => void;
  updateSettings: (newSettings: Partial<AnalysisSettings>) => void;
  resetFilters: () => void;
  reset: () => void;
}

export const DEFAULT_SUGGESTION_RULES: AnalysisSettings["suggestionRules"] = {
  productStage: "成熟",
  negativeMinClicks: 12,
  negativeMinSpend: 25,
  harvestMinClicks: 4,
  harvestMinOrders: 1,
  harvestMinCvrPct: 12,
  bidMinClicks: 6,
  bidUpAcosFactor: 0.7,
  bidDownAcosFactor: 1.3,
  highClickMinClicks: 40,
  highClickMaxCvrPct: 5,
  adGroupNoOrderMinClicks: 10,
  highAcosThreshold: 40,
};

const getDefaultSettings = (): AnalysisSettings => ({
  targetAcos: 30,
  minClicks: null,
  minImpressions: null,
  spendMin: null,
  spendMax: null,
  salesMin: null,
  salesMax: null,
  ordersMin: null,
  ordersMax: null,
  clicksMax: null,
  impressionsMax: null,
  ctrMinPct: null,
  ctrMaxPct: null,
  cpcMin: null,
  cpcMax: null,
  acosMin: null,
  acosMax: null,
  roasMin: null,
  roasMax: null,
  conversionRateMinPct: null,
  conversionRateMaxPct: null,
  currency: 'USD',
  searchTerm: '',
  quickFilter: '',
  excludeTerm: '',
  campaignNames: [],
  adGroupNames: [],
  matchTypes: [],
  conversion: '全部',
  viewMode: "按搜索词汇总",
  chartTopN: 200,
  suggestionRules: DEFAULT_SUGGESTION_RULES,
  dateRange: {},
});

export const useStore = create<AppState>((set) => ({
  data: null,
  fileName: null,
  isLoading: false,
  settings: getDefaultSettings(),
  filtersVersion: 0,
  
  setData: (data, fileName) =>
    set((state) => {
      const dates = data.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const minYmd = dates.length ? dates.reduce((acc, d) => (d < acc ? d : acc), dates[0]) : null;
      const maxYmd = dates.length ? dates.reduce((acc, d) => (d > acc ? d : acc), dates[0]) : null;
      const dateRange =
        minYmd && maxYmd
          ? {
              from: new Date(`${minYmd}T00:00:00.000Z`),
              to: new Date(`${maxYmd}T00:00:00.000Z`),
            }
          : {};

      return {
        data,
        fileName,
        settings: { ...state.settings, dateRange },
      };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  updateSettings: (newSettings) => set((state) => ({ 
    settings: { ...state.settings, ...newSettings } 
  })),
  resetFilters: () =>
    set((state) => ({
      filtersVersion: state.filtersVersion + 1,
      settings: {
        ...state.settings,
        minClicks: null,
        minImpressions: null,
        spendMin: null,
        spendMax: null,
        salesMin: null,
        salesMax: null,
        ordersMin: null,
        ordersMax: null,
        clicksMax: null,
        impressionsMax: null,
        ctrMinPct: null,
        ctrMaxPct: null,
        cpcMin: null,
        cpcMax: null,
        acosMin: null,
        acosMax: null,
        roasMin: null,
        roasMax: null,
        conversionRateMinPct: null,
        conversionRateMaxPct: null,
        searchTerm: '',
        quickFilter: '',
        excludeTerm: '',
        campaignNames: [],
        adGroupNames: [],
        matchTypes: [],
        conversion: '全部',
      },
    })),
  reset: () =>
    set((state) => ({
      data: null,
      fileName: null,
      isLoading: false,
      settings: getDefaultSettings(),
      filtersVersion: state.filtersVersion + 1,
    }))
}));
