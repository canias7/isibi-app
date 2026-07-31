import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HarvestRotation } from "@/components/charts/lib/forestry"
const compartments = [
  { name: "Cpt 3", hectares: 18, plantedYear: 1968, yieldM3PerHa: 480 },
  { name: "Cpt 7", hectares: 24, plantedYear: 1971, yieldM3PerHa: 510 },
  { name: "Cpt 12", hectares: 12, plantedYear: 1972, yieldM3PerHa: 460 },
  { name: "Cpt 19", hectares: 31, plantedYear: 1984, yieldM3PerHa: 530 },
  { name: "Cpt 22", hectares: 16, plantedYear: 1986, yieldM3PerHa: 495 },
  { name: "Cpt 28", hectares: 22, plantedYear: 1994, yieldM3PerHa: 505 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Felling plan</CardTitle>
        <CardDescription>The cut each year against even flow</CardDescription>
      </CardHeader>
      <CardContent>
        <HarvestRotation compartments={compartments} rotationYears={55} horizonYears={40} fromYear={2020} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An age-class gap no plan can undo <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Forty years
        </div>
      </CardFooter>
    </Card>
  )
}
