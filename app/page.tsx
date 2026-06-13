import { AuthProvider } from '@/components/auth/AuthProvider';
import { FeatureProvider } from '@/components/providers/FeatureProvider';
import { AppRoot } from '@/components/layout/AppRoot';

export default function Home() {
  return (
    <AuthProvider>
      <FeatureProvider>
        <AppRoot />
      </FeatureProvider>
    </AuthProvider>
  );
}
