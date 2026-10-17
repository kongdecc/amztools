// Delivery peak season crosses the calendar year: October 15 through January 14.
export function getDeliverySeason(date = new Date()) {
  const year = date.getFullYear();
  const monthDay = (date.getMonth() + 1) * 100 + date.getDate();
  const peak = monthDay >= 1015 || monthDay <= 114;
  // The calculator currently exposes only the 2025 and 2026 rate versions.
  const rateYear = monthDay <= 114 ? year - 1 : year;
  return {
    season: peak ? 'peak' : 'non_peak',
    version: rateYear >= 2026 ? '2026' : '2025',
  };
}
