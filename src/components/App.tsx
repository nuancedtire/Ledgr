import AuthGuard from './AuthGuard';
import Dashboard from './Dashboard';

export default function App() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
