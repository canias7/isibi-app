import { Construction } from "lucide-react";
import { motion } from "framer-motion";
import { Code2, Webhook, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import APIKeysSection from "@/components/developer/APIKeysSection";
import WebhooksSection from "@/components/developer/WebhooksSection";
import DocumentationSection from "@/components/developer/DocumentationSection";

export default function DashboardDeveloper() {
  return (
    <div className="space-y-6">
      {/* Under Construction Banner */}
      <div className="flex flex-col items-center py-6 space-y-4">
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Construction className="h-16 w-16 text-primary" />
        </motion.div>

        <div className="overflow-hidden w-full max-w-2xl">
          <motion.h1
            className="text-3xl md:text-5xl font-extrabold text-foreground whitespace-nowrap text-center"
            animate={{ x: ["100%", "-100%"] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          >
            🚧 Section Under Construction 🚧
          </motion.h1>
        </div>

        <motion.p
          className="text-sm text-muted-foreground text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          We're building something great here. Features below are in preview.
        </motion.p>
      </div>

      {/* Existing Developer Content */}
      <div className="opacity-75">
        <div>
          <h2 className="text-xl font-bold text-foreground">Developer</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage API keys, webhooks, and integrate your applications.</p>
        </div>

        <Tabs defaultValue="api-keys" className="w-full space-y-6 mt-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="api-keys" className="gap-2">
              <Code2 className="h-4 w-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="mt-4">
            <APIKeysSection />
          </TabsContent>
          <TabsContent value="webhooks" className="mt-4">
            <WebhooksSection />
          </TabsContent>
          <TabsContent value="docs" className="mt-4">
            <DocumentationSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
