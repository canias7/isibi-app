import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FloorPlate } from "@/components/charts/lib/realestate"
const floors = Array.from({ length: 7 }, (_, i) => ({
  name: i === 0 ? "Ground" : `Floor ${i}`,
  grossSqm: i === 0 ? 980 : 820 - i * 8,
  coreSqm: 96,
  circulationSqm: i === 0 ? 140 : 74,
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usable against gross</CardTitle>
        <CardDescription>Efficiency floor by floor</CardDescription>
      </CardHeader>
      <CardContent>
        <FloorPlate floors={floors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The tenant pays gross either way <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Seven floors
        </div>
      </CardFooter>
    </Card>
  )
}
