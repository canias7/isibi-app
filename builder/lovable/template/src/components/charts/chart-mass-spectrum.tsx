import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MassSpectrum } from "@/components/charts/lib/chemlab"
const ions = [
  { mz: 27, abundance: 18 }, { mz: 29, abundance: 34 }, { mz: 39, abundance: 22 },
  { mz: 43, abundance: 100, note: "base" }, { mz: 57, abundance: 46 },
  { mz: 71, abundance: 21 }, { mz: 85, abundance: 12 }, { mz: 99, abundance: 6 },
  { mz: 114, abundance: 9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fragment pattern</CardTitle>
        <CardDescription>Normalised to the base peak</CardDescription>
      </CardHeader>
      <CardContent>
        <MassSpectrum ions={ions} molecularIon={114} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Everything is relative to the base <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Electron impact
        </div>
      </CardFooter>
    </Card>
  )
}
