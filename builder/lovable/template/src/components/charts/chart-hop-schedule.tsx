import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HopSchedule } from "@/components/charts/lib/brewing"
const additions = [
  { name: "Magnum", grams: 22, alphaAcid: 13.5, atMinute: 0 },
  { name: "Centennial", grams: 30, alphaAcid: 9.8, atMinute: 30 },
  { name: "Citra", grams: 40, alphaAcid: 12.1, atMinute: 50 },
  { name: "Mosaic", grams: 60, alphaAcid: 11.4, atMinute: 58 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hop additions</CardTitle>
        <CardDescription>IBU by Tinseth utilisation</CardDescription>
      </CardHeader>
      <CardContent>
        <HopSchedule
          additions={additions}
          boilMinutes={60}
          batchLitres={21}
          originalGravity={1.056}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The whirlpool charge adds almost no bitterness <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          60-minute boil
        </div>
      </CardFooter>
    </Card>
  )
}
