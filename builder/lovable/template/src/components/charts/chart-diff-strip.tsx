import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DiffStrip } from "@/components/charts/lib/biolang"
const files = [
  { name: "src/worker.ts", added: 148, removed: 62, context: 1840 },
  { name: "src/lib/rows.ts", added: 96, removed: 14, context: 420 },
  { name: "src/routes/index.tsx", added: 34, removed: 88, context: 260 },
  { name: "test/rows.test.ts", added: 210, removed: 4, context: 120 },
  { name: "README.md", added: 12, removed: 9, context: 74 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change by file</CardTitle>
        <CardDescription>Added, removed and unchanged</CardDescription>
      </CardHeader>
      <CardContent>
        <DiffStrip files={files} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Bar width is file size <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One pull request
        </div>
      </CardFooter>
    </Card>
  )
}
