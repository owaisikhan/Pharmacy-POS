// The sidebar, as data. Icons are passed by name so this list can cross the
// server/client boundary.
export const NAV = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/pos", label: "New sale", icon: "ScanBarcode", key: "F2" },
  { href: "/sales", label: "Bills and returns", icon: "ReceiptText" },
  { href: "/medicines", label: "Medicines", icon: "Pill" },
  { href: "/expiry", label: "Expiry", icon: "CalendarClock" },
  { href: "/customers", label: "Customers", icon: "Users" },
  { href: "/shifts", label: "Cash shifts", icon: "Wallet" },
  { href: "/purchases", label: "Purchases", icon: "PackagePlus", admin: true },
  { href: "/suppliers", label: "Suppliers", icon: "Truck", admin: true },
  { href: "/reports", label: "Reports", icon: "ChartColumn", admin: true },
  { href: "/settings", label: "Settings", icon: "Settings", admin: true },
];
