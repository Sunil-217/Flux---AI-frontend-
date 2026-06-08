import { AuthProvider } from '@/components/auth/AuthProvider';
import { AppRoot } from '@/components/layout/AppRoot';

export default function Home() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
