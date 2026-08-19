export function parseDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isEmployeeWeeklyOff(dateStrOrObj: string | Date, emp: any, policies: any[]): boolean {
  if (!emp.weeklyOffPolicyId) {
    const dateObj = typeof dateStrOrObj === "string" ? parseDateStr(dateStrOrObj) : dateStrOrObj;
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
    return dayName === "Sunday";
  }

  const policy = policies.find(p => p.id === emp.weeklyOffPolicyId);
  return isDateWeeklyOff(dateStrOrObj, policy);
}

export function isDateWeeklyOff(dateStrOrObj: string | Date, policy: any): boolean {
  const dateObj = typeof dateStrOrObj === "string" ? parseDateStr(dateStrOrObj) : dateStrOrObj;
  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });

  if (!policy) {
    return dayName === "Sunday";
  }

  if (!policy.offDays) {
    // Rotational / No specific off days
    return dayName === "Sunday";
  }

  let offDays: string[] = [];
  try {
    offDays = JSON.parse(policy.offDays);
  } catch (e) {
    return dayName === "Sunday";
  }

  if (!offDays.includes(dayName)) {
    return false;
  }

  const policyType = policy.policyType;
  const dayOfMonth = dateObj.getDate();
  const policyName = policy.name?.toLowerCase() || "";

  if (policyName.includes("month-")) {
    const match = policyName.match(/month-(\d+)/);
    if (match) {
      const limit = parseInt(match[1], 10);
      return dayOfMonth <= (limit * 7);
    }
  }

  if (policyName.includes("week-")) {
    const match = policyName.match(/week-(\d+)/);
    if (match) {
      return true;
    }
  }

  if (policyType === "one_week_per_month" || policyType === "one_day_per_month") {
    // Only the first week's occurrence of the off days (day of month <= 7)
    return dayOfMonth <= 7;
  }

  if (policyType === "two_weeks_per_month") {
    // Only the first 2 weeks' occurrences of the off days (day of month <= 14)
    return dayOfMonth <= 14;
  }

  if (policyType === "three_weeks_per_month") {
    // Only the first 3 weeks' occurrences of the off days (day of month <= 21)
    return dayOfMonth <= 21;
  }

  if (policyType === "four_days_per_month" || policyType === "four_weeks_per_month") {
    // Only the first 4 weeks' occurrences of the off days (day of month <= 28)
    return dayOfMonth <= 28;
  }

  // "one_day_per_week", "two_days_per_week", "custom", "rotational", etc.
  return true;
}
