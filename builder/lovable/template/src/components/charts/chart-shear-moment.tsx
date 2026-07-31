import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShearMoment } from "@/components/charts/lib/chem"
const loads = [
  { at: 2.5, kn: 40 },
  { at: 6, kn: 25 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Beam diagrams</CardTitle>
        <CardDescription>Shear and bending moment, integrated from the loads</CardDescription>
      </CardHeader>
      <CardContent>
        <ShearMoment length={9} loads={loads} supports={[0.5, 8.5]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Moment peaks where shear crosses zero <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Simply supported, two point loads
        </div>
      </CardFooter>
    </Card>
  )
}
