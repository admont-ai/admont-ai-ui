import { AppLayout } from "@/components/layout/AppLayout"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/contexts/auth-context"
import { AiLogProvider } from "@/hooks/use-ai-log"

function App() {
  return (
    <AuthProvider>
      <AiLogProvider>
        <AppLayout />
      </AiLogProvider>
      <Toaster position="bottom-right" duration={4000} />
    </AuthProvider>
  )
}

export default App
