import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HandicapCorrection } from "@/components/charts/lib/sailing"
const boats = [
  { name: "Ariadne · J/109", elapsedMin: 268, tcf: 1.042 },
  { name: "Meridian · First 40", elapsedMin: 259, tcf: 1.081 },
  { name: "Kestrel · Sigma 38", elapsedMin: 294, tcf: 0.952 },
  { name: "Halcyon · Sun Fast 3300", elapsedMin: 272, tcf: 1.026 },
  { name: "Petrel · Contessa 32", elapsedMin: 331, tcf: 0.848 },
  { name: "Corvus · X-332", elapsedMin: 288, tcf: 0.974 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Corrected time</CardTitle>
        <CardDescription>Won on a number nobody computes on the water</CardDescription>
      </CardHeader>
      <CardContent>
        <HandicapCorrection boats={boats} courseNm={24} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Line honours and the win are different boats <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          24-mile course
        </div>
      </CardFooter>
    </Card>
  )
}
