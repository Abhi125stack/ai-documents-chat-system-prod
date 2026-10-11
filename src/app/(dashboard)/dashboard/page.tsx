"use client";

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary';
import { WelcomeHero } from '@/shared/components/WelcomeHero';

const UploadZone = dynamic(() => import('@/shared/components/UploadZone').then(mod => mod.UploadZone), {
  loading: () => <div className="h-80 w-full animate-pulse bg-card rounded-4xl border border-border shadow-xl" />,
  ssr: false
});

export default function DashboardPage() {
  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Primary Actions */}
      <ErrorBoundary>
        <UploadZone />
      </ErrorBoundary>

      {/* Welcome Hero (Server Component) */}
      <WelcomeHero />

    </div>
  );
}

