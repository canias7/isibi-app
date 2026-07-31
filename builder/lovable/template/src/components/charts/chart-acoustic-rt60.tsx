import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AcousticRt60 } from "@/components/charts/lib/building"
const bands = [125, 250, 500, 1000, 2000, 4000]
const surfaces = [
  { name: "Plaster walls", areaM2: 260, alpha: [0.02, 0.02, 0.03, 0.04, 0.05, 0.05] },
  { name: "Concrete floor", areaM2: 180, alpha: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03] },
  { name: "Perforated ceiling", areaM2: 180, alpha: [0.18, 0.42, 0.78, 0.86, 0.82, 0.74] },
  { name: "Upholstered seats", areaM2: 120, alpha: [0.34, 0.48, 0.62, 0.68, 0.7, 0.68] },
  { name: "Glazing", areaM2: 44, alpha: [0.18, 0.06, 0.04, 0.03, 0.02, 0.02] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reverberation</CardTitle>
        <CardDescription>Sabine per octave band, with the absorption listed</CardDescription>
      </CardHeader>
      <CardContent>
        <AcousticRt60
          volumeM3={1450}
          surfaces={surfaces}
          bands={bands}
          targetSeconds={{ low: 0.7, high: 1 }}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The bass is where the treatment has to go <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Lecture theatre
        </div>
      </CardFooter>
    </Card>
  )
}
