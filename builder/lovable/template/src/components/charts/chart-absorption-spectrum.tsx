import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AbsorptionSpectrum } from "@/components/charts/lib/chem"
const spectrum = Array.from({ length: 121 }, (_, i) => {
  const nm = 380 + i * 3
  const soret = 1.0 * Math.exp(-((nm - 430) ** 2) / 320)
  const q = 0.62 * Math.exp(-((nm - 662) ** 2) / 260)
  return { nm, a: Number((soret + q + 0.03).toFixed(3)) }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Absorption spectrum</CardTitle>
        <CardDescription>Intensity against wavelength</CardDescription>
      </CardHeader>
      <CardContent>
        <AbsorptionSpectrum
          points={spectrum}
          peaks={[
            { nm: 430, label: "Soret 430" },
            { nm: 662, label: "Q 662" },
          ]}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two bands in the visible <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Chlorophyll a, schematic
        </div>
      </CardFooter>
    </Card>
  )
}
