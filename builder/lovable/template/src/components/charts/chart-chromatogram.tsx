import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Chromatogram } from "@/components/charts/lib/chemlab"
const peaks = [
  { rt: 1.8, height: 22, widthMin: 0.22, name: "solvent" },
  { rt: 4.1, height: 68, widthMin: 0.26, name: "A" },
  { rt: 5.9, height: 94, widthMin: 0.3, name: "B" },
  { rt: 6.35, height: 51, widthMin: 0.34, name: "C" },
  { rt: 9.4, height: 38, widthMin: 0.44, name: "D" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Separation</CardTitle>
        <CardDescription>Detector signal against retention time</CardDescription>
      </CardHeader>
      <CardContent>
        <Chromatogram peaks={peaks} runMinutes={12} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          R below 1.5 is not baseline separated <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reversed phase
        </div>
      </CardFooter>
    </Card>
  )
}
