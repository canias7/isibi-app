import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DependencyWheel } from "@/components/charts/lib/strategy"
const nodes = ["worker", "site-db", "site-schema", "page-gen", "publish", "rows", "auth"]
const links = [
  { from: "worker", to: "site-db", weight: 3 },
  { from: "worker", to: "site-schema", weight: 2 },
  { from: "worker", to: "page-gen", weight: 2 },
  { from: "worker", to: "auth", weight: 3 },
  { from: "publish", to: "page-gen", weight: 2 },
  { from: "publish", to: "worker", weight: 1 },
  { from: "site-schema", to: "site-db", weight: 2 },
  { from: "rows", to: "auth", weight: 1 },
  { from: "rows", to: "worker", weight: 2 },
  { from: "auth", to: "site-db", weight: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Module dependencies</CardTitle>
        <CardDescription>Arc length is traffic through each module</CardDescription>
      </CardHeader>
      <CardContent>
        <DependencyWheel nodes={nodes} links={links} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The widest arc is what everything touches <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Import graph
        </div>
      </CardFooter>
    </Card>
  )
}
