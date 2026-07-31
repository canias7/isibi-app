import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CacheHitRate } from "@/components/charts/lib/dbperf"
const tiers = [
  { name: "In-process", hitRate: 0.86, hitMs: 0.02, missMs: 1.4 },
  { name: "Redis", hitRate: 0.951, hitMs: 0.9, missMs: 180 },
  { name: "CDN edge", hitRate: 0.72, hitMs: 12, missMs: 340 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hit rate against miss cost</CardTitle>
        <CardDescription>Effective latency, computed</CardDescription>
      </CardHeader>
      <CardContent>
        <CacheHitRate tiers={tiers} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          95% hits is terrible if a miss costs 200x <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three tiers
        </div>
      </CardFooter>
    </Card>
  )
}
