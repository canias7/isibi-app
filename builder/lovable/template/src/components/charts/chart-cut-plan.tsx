import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CutPlan } from "@/components/charts/lib/textile"
const pieces = [
  { name: "Front", areaCm2: 2840, per: 2 },
  { name: "Back", areaCm2: 3120, per: 1 },
  { name: "Sleeve", areaCm2: 1960, per: 2 },
  { name: "Yoke", areaCm2: 740, per: 1 },
  { name: "Collar", areaCm2: 310, per: 2 },
  { name: "Cuff", areaCm2: 280, per: 2 },
  { name: "Placket", areaCm2: 190, per: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cutting plan</CardTitle>
        <CardDescription>Utilisation computed from the pieces</CardDescription>
      </CardHeader>
      <CardContent>
        <CutPlan markerLengthM={7.4} clothWidthCm={150} pieces={pieces} plies={60} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One point of marker is worth metres <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          60 plies
        </div>
      </CardFooter>
    </Card>
  )
}
