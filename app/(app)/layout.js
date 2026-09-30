import { Suspense } from "react";
import Sidebar from "@/app/_components/layout/Sidebar";
import Topbar from "@/app/_components/layout/Topbar";
import { NavigationProgressProvider, PendingRegion } from "@/app/_components/layout/NavigationProgress";
import { requireUser } from "@/app/_lib/helpers";
import { getOpenShift, getSettings } from "@/app/_lib/data-service";

// The gate for every signed-in screen. RLS refuses the data regardless; this
// keeps signed-out and inactive visitors off the pages.
export default async function AppLayout({ children }) {
  const { profile, isAdmin } = await requireUser();
  const [settings, shift] = await Promise.all([getSettings(), getOpenShift()]);

  return (
    <Suspense>
      <NavigationProgressProvider>
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <Sidebar isAdmin={isAdmin} pharmacyName={settings?.pharmacy_name || "Pharmacy POS"} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar profile={profile} shift={shift} />
            <main className="min-w-0 flex-1">
              <PendingRegion>{children}</PendingRegion>
            </main>
          </div>
        </div>
      </NavigationProgressProvider>
    </Suspense>
  );
}
