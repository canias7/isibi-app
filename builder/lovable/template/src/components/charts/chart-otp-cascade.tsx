import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OtpCascade } from "@/components/charts/lib/aviation"
const legs = [
  { flight: "BA1401", departMin: 0, blockMin: 75, groundMin: 40, ownDelayMin: 35 },
  { flight: "BA1402", departMin: 135, blockMin: 80, groundMin: 40 },
  { flight: "BA1417", departMin: 265, blockMin: 70, groundMin: 35, ownDelayMin: 12 },
  { flight: "BA1418", departMin: 380, blockMin: 75, groundMin: 35 },
  { flight: "BA1435", departMin: 500, blockMin: 65, groundMin: 40 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delay propagation</CardTitle>
        <CardDescription>One aircraft's day, delay carried forward</CardDescription>
      </CardHeader>
      <CardContent>
        <OtpCascade legs={legs} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ground time is the only place it recovers <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four sectors
        </div>
      </CardFooter>
    </Card>
  )
}
