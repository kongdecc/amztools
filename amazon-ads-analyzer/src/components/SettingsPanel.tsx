import { useMemo, useState } from "react";
import type { AdRecord } from "@/types";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FilterX, RotateCcw } from "lucide-react";

function toUniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function parseNumberInput(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  minPlaceholder = "最小",
  maxPlaceholder = "最大",
}: {
  label: string;
  minValue: number | null;
  maxValue: number | null;
  onChangeMin: (value: number | null) => void;
  onChangeMax: (value: number | null) => void;
  minPlaceholder?: string;
  maxPlaceholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          min={0}
          value={minValue === null ? "" : String(minValue)}
          placeholder={minPlaceholder}
          onChange={(e) => {
            const nextText = e.target.value;
            if (nextText.trim() === "") onChangeMin(null);
            else onChangeMin(Math.max(0, parseNumberInput(nextText)));
          }}
        />
        <Input
          type="number"
          min={0}
          value={maxValue === null ? "" : String(maxValue)}
          placeholder={maxPlaceholder}
          onChange={(e) => {
            const nextText = e.target.value;
            if (nextText.trim() === "") onChangeMax(null);
            else onChangeMax(Math.max(0, parseNumberInput(nextText)));
          }}
        />
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const summary = selected.length ? `${label}（${selected.length}）` : `${label}（全部）`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between w-full">
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[320px] max-h-[420px] overflow-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex gap-2 px-2 pb-2">
          <Button variant="secondary" size="sm" onClick={() => onChange([])}>
            全部
          </Button>
          <Button variant="outline" size="sm" onClick={() => onChange(options)}>
            全选
          </Button>
        </div>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selectedSet.has(opt)}
            onCheckedChange={(checked) => {
              if (checked) onChange([...selected, opt]);
              else onChange(selected.filter((x) => x !== opt));
            }}
          >
            <span className="truncate">{opt}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {!options.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>暂无可选项</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SettingsPanel({ data }: { data: AdRecord[] }) {
  const { settings, updateSettings, resetFilters, reset } = useStore();
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const campaignOptions = useMemo(() => toUniqueSorted(data.map((d) => d.campaignName)), [data]);
  const adGroupOptions = useMemo(() => toUniqueSorted(data.map((d) => d.adGroupName)), [data]);
  const matchTypeOptions = useMemo(() => toUniqueSorted(data.map((d) => d.matchType)), [data]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4 space-y-1">
          <Label>搜索词包含</Label>
          <Input
            value={settings.searchTerm}
            onChange={(e) => updateSettings({ searchTerm: e.target.value })}
            placeholder="例如：usb / 关键词"
          />
        </div>

        <div className="md:col-span-3 space-y-1">
          <Label>排除词</Label>
          <Input
            value={settings.excludeTerm}
            onChange={(e) => updateSettings({ excludeTerm: e.target.value })}
            placeholder="例如：free / 竞品词"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label>转化</Label>
          <Select value={settings.conversion} onValueChange={(v) => updateSettings({ conversion: v as typeof settings.conversion })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="全部">全部</SelectItem>
              <SelectItem value="有订单">有订单</SelectItem>
              <SelectItem value="无订单">无订单</SelectItem>
              <SelectItem value="有销售">有销售</SelectItem>
              <SelectItem value="无销售">无销售</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <Label>匹配类型</Label>
          <MultiSelectDropdown
            label="匹配类型"
            options={matchTypeOptions}
            selected={settings.matchTypes}
            onChange={(next) => updateSettings({ matchTypes: next })}
          />
        </div>

        <div className="md:col-span-1 flex gap-2">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={resetFilters}>
            <FilterX className="w-4 h-4" />
            清空
          </Button>
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            进一步按广告结构与阈值组合筛选
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {advancedOpen ? "收起筛选" : "更多筛选"}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4 space-y-1">
              <Label>广告活动</Label>
              <MultiSelectDropdown
                label="广告活动"
                options={campaignOptions}
                selected={settings.campaignNames}
                onChange={(next) => updateSettings({ campaignNames: next })}
              />
            </div>

            <div className="md:col-span-4 space-y-1">
              <Label>广告组</Label>
              <MultiSelectDropdown
                label="广告组"
                options={adGroupOptions}
                selected={settings.adGroupNames}
                onChange={(next) => updateSettings({ adGroupNames: next })}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>最少点击</Label>
              <Input
                type="number"
                min={0}
                value={settings.minClicks === null ? "" : String(settings.minClicks)}
                onChange={(e) => {
                  const nextText = e.target.value;
                  if (nextText.trim() === "") updateSettings({ minClicks: null });
                  else updateSettings({ minClicks: Math.max(0, Math.floor(parseNumberInput(nextText))) });
                }}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>最少展示</Label>
              <Input
                type="number"
                min={0}
                value={settings.minImpressions === null ? "" : String(settings.minImpressions)}
                onChange={(e) => {
                  const nextText = e.target.value;
                  if (nextText.trim() === "") updateSettings({ minImpressions: null });
                  else updateSettings({ minImpressions: Math.max(0, Math.floor(parseNumberInput(nextText))) });
                }}
              />
            </div>

            <div className="md:col-span-4">
              <RangeInput
                label="花费"
                minValue={settings.spendMin}
                maxValue={settings.spendMax}
                onChangeMin={(v) => updateSettings({ spendMin: v })}
                onChangeMax={(v) => updateSettings({ spendMax: v })}
              />
            </div>

            <div className="md:col-span-4">
              <RangeInput
                label="ACOS（%）"
                minValue={settings.acosMin}
                maxValue={settings.acosMax}
                onChangeMin={(v) => updateSettings({ acosMin: v })}
                onChangeMax={(v) => updateSettings({ acosMax: v })}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>散点 Top N</Label>
              <Input
                type="number"
                min={1}
                value={String(settings.chartTopN)}
                onChange={(e) => updateSettings({ chartTopN: Math.max(1, Math.floor(parseNumberInput(e.target.value))) })}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>货币</Label>
              <Input
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
              />
            </div>

            <div className="md:col-span-12 pt-2">
              <div className="text-sm text-muted-foreground pb-2">指标区间筛选（留空表示不限制）</div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <RangeInput
                    label="展示"
                    minValue={settings.minImpressions}
                    maxValue={settings.impressionsMax}
                    onChangeMin={(v) => updateSettings({ minImpressions: v === null ? null : Math.floor(v) })}
                    onChangeMax={(v) => updateSettings({ impressionsMax: v === null ? null : Math.floor(v) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="点击"
                    minValue={settings.minClicks}
                    maxValue={settings.clicksMax}
                    onChangeMin={(v) => updateSettings({ minClicks: v === null ? null : Math.floor(v) })}
                    onChangeMax={(v) => updateSettings({ clicksMax: v === null ? null : Math.floor(v) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="CTR（%）"
                    minValue={settings.ctrMinPct}
                    maxValue={settings.ctrMaxPct}
                    onChangeMin={(v) => updateSettings({ ctrMinPct: v })}
                    onChangeMax={(v) => updateSettings({ ctrMaxPct: v })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="CPC"
                    minValue={settings.cpcMin}
                    maxValue={settings.cpcMax}
                    onChangeMin={(v) => updateSettings({ cpcMin: v })}
                    onChangeMax={(v) => updateSettings({ cpcMax: v })}
                  />
                </div>

                <div className="md:col-span-3">
                  <RangeInput
                    label="销售额"
                    minValue={settings.salesMin}
                    maxValue={settings.salesMax}
                    onChangeMin={(v) => updateSettings({ salesMin: v })}
                    onChangeMax={(v) => updateSettings({ salesMax: v })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="订单"
                    minValue={settings.ordersMin}
                    maxValue={settings.ordersMax}
                    onChangeMin={(v) => updateSettings({ ordersMin: v === null ? null : Math.floor(v) })}
                    onChangeMax={(v) => updateSettings({ ordersMax: v === null ? null : Math.floor(v) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="ROAS"
                    minValue={settings.roasMin}
                    maxValue={settings.roasMax}
                    onChangeMin={(v) => updateSettings({ roasMin: v })}
                    onChangeMax={(v) => updateSettings({ roasMax: v })}
                  />
                </div>
                <div className="md:col-span-3">
                  <RangeInput
                    label="转化率（%）"
                    minValue={settings.conversionRateMinPct}
                    maxValue={settings.conversionRateMaxPct}
                    onChangeMin={(v) => updateSettings({ conversionRateMinPct: v })}
                    onChangeMax={(v) => updateSettings({ conversionRateMaxPct: v })}
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-12 space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <Label>目标 ACOS（用于标记颜色）</Label>
                <span className="text-sm font-medium text-primary">
                  {settings.targetAcos}%
                </span>
              </div>
              <Slider
                value={[settings.targetAcos]}
                onValueChange={([v]) => updateSettings({ targetAcos: v })}
                max={100}
                step={1}
              />
            </div>

            <div className="md:col-span-12 flex flex-col md:flex-row gap-2 pt-2">
              <Button variant="outline" className="gap-2" onClick={reset}>
                <RotateCcw className="w-4 h-4" />
                重置数据与设置
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
