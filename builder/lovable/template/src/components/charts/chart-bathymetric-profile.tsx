import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BathymetricProfile } from "@/components/charts/lib/carto"
const seabed = Array.from({ length: 90 }, (_, i) => {
  const km = i * 4
  const shelf = 140 / (1 + Math.exp(-(km - 55) / 14))
  const basin = 1900 * Math.exp(-((km - 130) ** 2) / 5200)
  const rise = 620 * Math.exp(-((km - 250) ** 2) / 9000)
  return { km, depth: Math.round(shelf + basin + rise + 30) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cable route seabed</CardTitle>
        <CardDescription>Depth along the crossing</CardDescription>
      </CardHeader>
      <CardContent>
        <BathymetricProfile
          points={seabed}
          marks={[
            { km: 60, label: "shelf edge" },
            { km: 130, label: "basin" },
            { km: 250, label: "ridge" },
          ]}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Deepest point a third of the way over <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Metres below sea level
        </div>
      </CardFooter>
    </Card>
  )
}
