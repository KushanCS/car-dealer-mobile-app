export const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
};

export const formatCompactNumber = (value) => {
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return Number(value || 0) > 999 
    ? formatter.format(Number(value || 0)) 
    : String(Number(value || 0));
};

export const formatVehicleTitle = (vehicle) => {
  if (!vehicle) return "Vehicle";
  return [vehicle.brand, vehicle.model || vehicle.type].filter(Boolean).join(" ");
};

export const formatTimeStamp = (value) => {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export const formatRelativeDay = (value) => {
  if (!value) return "---";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "---";

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(target);
};
