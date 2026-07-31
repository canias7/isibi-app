import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PartitionSkew } from "@/components/charts/lib/dbperf"
let s = 3
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const partitions = Array.from({ length: 64 }, (_, i) => ({
  key: `p${i}`,
  rows: i === 17 ? 2_400_000 : i === 42 ? 810_000 : Math.round(120_000 + r() * 90_000),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rows per partition</CardTitle>
        <CardDescription>Against an even split</CardDescription>
      </CardHeader>
      <CardContent>
        <PartitionSkew partitions={partitions} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One hot shard is the whole latency story <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          64 partitions
        </div>
      </CardFooter>
    </Card>
  )
}
