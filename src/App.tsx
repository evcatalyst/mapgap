import { ErrorBoundary } from "./app/ErrorBoundary";
import { AppShell } from "./app/AppShell";
import { Providers } from "./app/Providers";

export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppShell />
      </Providers>
    </ErrorBoundary>
  );
}
