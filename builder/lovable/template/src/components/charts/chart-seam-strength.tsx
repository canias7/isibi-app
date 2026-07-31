import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SeamStrength } from "@/components/charts/lib/textile"
const seams = [
  { name: "Flat-felled", strengthN: 580, stitchesPerCm: 4 },
  { name: "French", strengthN: 512, stitchesPerCm: 4 },
  { name: "Plain, overlocked", strengthN: 468, stitchesPerCm: 3.5 },
  { name: "Plain, 2 st/cm", strengthN: 392, stitchesPerCm: 2 },
  { name: "Bonded", strengthN: 311 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seam strength</CardTitle>
        <CardDescription>As a fraction of the cloth it joins</CardDescription>
      </CardHeader>
      <CardContent>
        <SeamStrength fabricStrengthN={640} seams={seams} minimumEfficiency={0.8} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A 300 N seam is a failure in canvas <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Fabric 640 N
        </div>
      </CardFooter>
    </Card>
  )
}
