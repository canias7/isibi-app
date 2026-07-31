import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CreepCurve } from "@/components/charts/lib/materials"
const mk = (rate: number, tert: number, name: string) => ({
  label: name,
  points: Array.from({ length: 60 }, (_, i) => {
    const h = i * 200
    return { hours: h, strain: 0.004 * (1 - Math.exp(-h / 900)) + rate * h + Math.pow(h / 12000, tert) * 0.02 }
  }),
})
const curves = [mk(2.4e-7, 7, "180 MPa"), mk(1.1e-7, 9, "150 MPa"), mk(4e-8, 12, "120 MPa")]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Creep under load</CardTitle>
        <CardDescription>Strain over time at temperature</CardDescription>
      </CardHeader>
      <CardContent>
        <CreepCurve curves={curves} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The flat middle sets the design life <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Three stresses
        </div>
      </CardFooter>
    </Card>
  )
}
