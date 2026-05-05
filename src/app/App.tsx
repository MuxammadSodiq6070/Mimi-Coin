import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { router } from "./routes";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors theme="dark" />
    </ErrorBoundary>
  );
}
