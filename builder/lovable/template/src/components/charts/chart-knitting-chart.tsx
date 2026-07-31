import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { KnittingChart } from "@/components/charts/lib/craft"
const P = ["k", "p", "k", "p", "k", "p", "k", "p"]
const K = ["k", "k", "k", "k", "k", "k", "k", "k"]
const C = ["k", "k", "c", "c", "c", "c", "k", "k"]
const Y = ["k", "o", "k", "k", "k", "k", "o", "k"]
const rows = [K, P, K, C, K, Y, K, P, K, C, K, Y]
const legend = [
  { symbol: "k", name: "knit" },
  { symbol: "p", name: "purl" },
  { symbol: "c", name: "cable 4" },
  { symbol: "o", name: "yarn over" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stitch chart</CardTitle>
        <CardDescription>Read bottom-up, alternating direction</CardDescription>
      </CardHeader>
      <CardContent>
        <KnittingChart rows={rows} legend={legend} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Row numbers say which way to read <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve-row repeat
        </div>
      </CardFooter>
    </Card>
  )
}
