import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PhenolicRipeness } from "@/components/charts/lib/winery"
const samples = [
  { date: "18 Aug", skin: 0.31, seed: 0.12, brix: 19.4 },
  { date: "25 Aug", skin: 0.44, seed: 0.19, brix: 21.1 },
  { date: "1 Sep", skin: 0.56, seed: 0.28, brix: 22.6 },
  { date: "8 Sep", skin: 0.66, seed: 0.38, brix: 23.8 },
  { date: "15 Sep", skin: 0.73, seed: 0.49, brix: 24.6 },
  { date: "22 Sep", skin: 0.78, seed: 0.59, brix: 25.2 },
  { date: "29 Sep", skin: 0.81, seed: 0.68, brix: 25.9 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Phenolics</CardTitle>
        <CardDescription>Skins ripen first, seeds catch up late</CardDescription>
      </CardHeader>
      <CardContent>
        <PhenolicRipeness samples={samples} seedTarget={0.6} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Picking on sugar takes the fruit with green seeds <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Extractability index
        </div>
      </CardFooter>
    </Card>
  )
}
